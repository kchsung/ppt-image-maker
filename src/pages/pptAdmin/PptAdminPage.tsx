import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Download, ExternalLink, Play, RefreshCcw, RotateCcw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { enhancePptDocument } from '@/services/pptDocument.service';
import { pptExportService } from '@/services/pptExport.service';
import { pptAdminService } from '@/services/pptAdmin.service';
import { defaultPptTemplate } from '@/mocks/pptTemplates.mock';
import { resetDeckPlan, updateForm } from '@/features/pptMaker/pptMakerSlice';
import { useAppDispatch } from '@/hooks/redux';
import type { GeneratedImageDeck, GeneratedSlideImage } from '@/types/models/pptMaker.model';
import type { AdminGenerationItem, AdminGenerationJob, AdminGenerationSummary } from '@/types/models/pptAdmin.model';
import { isPptxGenerationInProgress, isPptxGenerationStale } from '@/utils/pptxGeneration';

const STATUS_LABELS: Record<AdminGenerationJob['status'], string> = {
  pending: 'Pending',
  processing: 'Processing',
  succeeded: 'Succeeded',
  failed: 'Failed',
};

const JOBS_PER_PAGE = 3;

export function PptAdminPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<AdminGenerationSummary>({ jobs: [] });
  const [status, setStatus] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [retryingItemIds, setRetryingItemIds] = useState<string[]>([]);
  const [queuedItemIds, setQueuedItemIds] = useState<string[]>([]);
  const [resumingJobId, setResumingJobId] = useState<string | null>(null);
  const [exportingJobId, setExportingJobId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const retryQueuesRef = useRef(new Map<string, Promise<void>>());
  const pptxStatusesRef = useRef(new Map<string, AdminGenerationJob['pptxStatus']>());
  const isLoading = status === 'loading';

  const pageCount = Math.max(1, Math.ceil(summary.jobs.length / JOBS_PER_PAGE));
  const pagedJobs = useMemo(
    () => summary.jobs.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE),
    [currentPage, summary.jobs],
  );

  const totals = useMemo(
    () => ({
      all: summary.jobs.length,
      succeeded: summary.jobs.filter((job) => job.status === 'succeeded').length,
      failed: summary.jobs.filter((job) => job.status === 'failed').length,
      processing: summary.jobs.filter((job) => job.status === 'processing' || job.status === 'pending').length,
    }),
    [summary.jobs],
  );

  const loadJobs = useCallback(async (silent = false) => {
    if (!silent) setStatus('loading');
    try {
      const nextSummary = await pptAdminService.listGenerationJobs();
      nextSummary.jobs.forEach((job) => {
        const previousStatus = pptxStatusesRef.current.get(job.id);
        if (previousStatus === 'processing' && job.pptxStatus === 'succeeded') {
          toast.success(`${job.title} PPTX is ready.`);
        }
        if (previousStatus === 'processing' && job.pptxStatus === 'failed') {
          toast.error(`${job.title} PPTX generation failed.`);
        }
        pptxStatusesRef.current.set(job.id, job.pptxStatus);
      });
      setSummary(nextSummary);
      setStatus('idle');
    } catch (error) {
      setStatus('failed');
      toast.error(error instanceof Error ? error.message : 'Failed to load generation jobs.');
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const hasPptxGenerationInProgress = summary.jobs.some((job) => isPptxGenerationInProgress(job, exportingJobId));
  useEffect(() => {
    if (!hasPptxGenerationInProgress) return;
    const timer = window.setInterval(() => void loadJobs(true), 5_000);
    return () => window.clearInterval(timer);
  }, [hasPptxGenerationInProgress, loadJobs]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  const handleDelete = async (job: AdminGenerationJob) => {
    const shouldDelete = window.confirm(
      `Delete "${job.title}" and its generated PPT assets from Supabase?`,
    );
    if (!shouldDelete) {
      return;
    }

    setDeletingJobId(job.id);
    try {
      await pptAdminService.deleteGenerationJob(job.id);
      setSummary((current) => ({
        jobs: current.jobs.filter((item) => item.id !== job.id),
      }));
      toast.success('Presentation deleted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete generation job.');
    } finally {
      setDeletingJobId(null);
    }
  };

  const handleRetryItem = (jobId: string, item: AdminGenerationItem) => {
    if (retryingItemIds.includes(item.id) || queuedItemIds.includes(item.id)) {
      return;
    }

    const previous = retryQueuesRef.current.get(jobId);
    if (previous) {
      setQueuedItemIds((current) => [...current, item.id]);
    }

    const task = (previous ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        setQueuedItemIds((current) => current.filter((queuedItemId) => queuedItemId !== item.id));
        setRetryingItemIds((current) => [...current, item.id]);
        try {
          await pptAdminService.retryGenerationItem(jobId, item.id);
          toast.success(`Slide ${item.pageNumber} regenerated.`);
          await loadJobs();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : `Failed to retry slide ${item.pageNumber}.`);
        } finally {
          setRetryingItemIds((current) => current.filter((retryingItemId) => retryingItemId !== item.id));
        }
      });

    retryQueuesRef.current.set(jobId, task);
    void task.finally(() => {
      if (retryQueuesRef.current.get(jobId) === task) {
        retryQueuesRef.current.delete(jobId);
      }
    });
  };

  const handleResumeJob = async (job: AdminGenerationJob) => {
    const retryableItems = getRetryableItems(job);
    if (retryableItems.length === 0) {
      toast.info('No pending or failed slides to resume.');
      return;
    }

    setResumingJobId(job.id);
    try {
      let succeededCount = 0;
      let failedCount = 0;
      for (const item of retryableItems) {
        try {
          await pptAdminService.retryGenerationItem(job.id, item.id);
          succeededCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      if (failedCount > 0) {
        toast.error(`Resumed ${succeededCount}/${retryableItems.length} slide(s). ${failedCount} failed.`);
      } else {
        toast.success(`Resumed ${retryableItems.length} slide(s).`);
      }
      await loadJobs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resume generation job.');
      await loadJobs();
    } finally {
      setResumingJobId(null);
    }
  };

  const handleGeneratePptx = async (job: AdminGenerationJob) => {
    if (isPptxGenerationInProgress(job, exportingJobId)) {
      toast.info('PPTX is already being generated.');
      return;
    }

    if (!job.deckPlan) {
      toast.error('This job does not include the original deck plan.');
      return;
    }

    const missingImages = job.items.filter((item) => item.status !== 'succeeded' || !item.imageUrl);
    if (missingImages.length > 0) {
      toast.error('Generate all slide images before exporting PPTX.');
      return;
    }

    setExportingJobId(job.id);
    try {
      if (isPptxGenerationStale(job)) {
        toast.info('The previous PPTX worker stopped updating. Starting a new PPTX job.');
      }
      const imageDeck = createImageDeckFromJob(job);
      const enhancement = await enhancePptDocument(job.deckPlan, imageDeck);
      if (enhancement.pptxStatus === 'processing') {
        toast.success('PPTX generation started. The file will appear here when Claude finishes.');
        await loadJobs();
        return;
      }
      if (enhancement.pptxUrl) {
        toast.success('Claude native editable PPTX was saved to Supabase Storage.');
        await loadJobs();
        return;
      }

      if (enhancement.generationMode !== 'browser-fallback') {
        throw new Error('Claude did not return a native PPTX file.');
      }
      const pptxBlob = await pptExportService.createImageDeckBlob(imageDeck, job.deckPlan, enhancement);
      await pptAdminService.savePptxOutput(job.id, enhancement.fileName, pptxBlob);
      toast.success('PPTX saved to Supabase Storage.');
      await loadJobs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate PPTX.');
    } finally {
      setExportingJobId(null);
    }
  };

  const handleRebuildLegacyJob = (job: AdminGenerationJob) => {
    const request = job.deckPlan?.request;
    if (!request?.sourceText.trim()) {
      toast.error('This legacy job does not include the original input needed to rebuild it.');
      return;
    }

    const usesUploadedStyle = Boolean(request.styleImageDataUrl) && !request.selectedTemplateId;
    dispatch(resetDeckPlan());
    dispatch(updateForm({
      sourceText: request.sourceText,
      targetLanguage: request.targetLanguage,
      audience: request.audience,
      purpose: request.purpose,
      slideCount: request.slideCount,
      styleNotes: request.styleReference.notes,
      styleSourceMode: usesUploadedStyle ? 'upload' : 'template',
      selectedTemplateId: request.selectedTemplateId ?? defaultPptTemplate.id,
      styleImageDataUrl: request.styleImageDataUrl ?? null,
      logoImageDataUrl: request.logoImageDataUrl ?? null,
    }));
    navigate('/ppt-maker');
    toast.info('Original inputs were restored. Generate a new Claude-validated deck.');
  };

  return (
    <>
      <PageHeader
        eyebrow="QLEARN Startup"
        title="PPT List"
        description="Browse saved presentation projects, open the final PPTX preview, download files, or continue incomplete generation."
        actions={
          <Button variant="secondary" onClick={() => void loadJobs()} disabled={isLoading}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <SummaryTile label="Total" value={totals.all} />
        <SummaryTile label="Succeeded" value={totals.succeeded} />
        <SummaryTile label="Running" value={totals.processing} />
        <SummaryTile label="Failed" value={totals.failed} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-primary">Saved presentations</h2>
              <p className="mt-1 text-sm text-text-subtle">
                Latest 50 presentation projects are shown first. Showing {JOBS_PER_PAGE} projects per page.
              </p>
            </div>
            {isLoading ? <Badge>Loading</Badge> : null}
          </div>
        </CardHeader>
        <CardContent>
          {summary.jobs.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-surface-muted p-8 text-center">
              <p className="text-sm font-semibold text-text-main">No saved presentations yet</p>
              <p className="mt-1 text-sm text-text-subtle">Completed PPTX files and in-progress presentation projects will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pagedJobs.map((job) => (
                <article key={job.id} className="overflow-hidden rounded-md border border-border bg-surface">
                  <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-primary">
                          {isLegacyCopyPlan(job) ? 'Legacy generation - copy plan needs rebuild' : job.title}
                        </h3>
                        <Badge>{STATUS_LABELS[job.status]}</Badge>
                        {isLegacyCopyPlan(job) ? <Badge>Legacy Copy</Badge> : null}
                        {isPptxGenerationInProgress(job, exportingJobId) ? (
                          <Badge>PPTX Generating</Badge>
                        ) : isPptxGenerationStale(job) ? (
                          <Badge>PPTX Interrupted</Badge>
                        ) : job.pptxUrl ? (
                          <Badge>PPTX Ready</Badge>
                        ) : (
                          <Badge>PPTX Not Generated</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-text-subtle">
                        {format(new Date(job.createdAt), 'yyyy-MM-dd HH:mm')} · {job.completedItems}/{job.totalItems} slides ·{' '}
                        {job.progress}%
                      </p>
                      {isPptxGenerationInProgress(job, exportingJobId) ? (
                        <div className="mt-2 max-w-md">
                          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-primary">
                            <span>{job.pptxPhase ?? 'Preparing the editable PPTX'}</span>
                            <span>{job.pptxProgress ?? 0}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-[width] duration-500"
                              style={{ width: `${Math.max(5, job.pptxProgress ?? 5)}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-text-subtle">This list refreshes automatically while the file is being created.</p>
                        </div>
                      ) : null}
                      {isPptxGenerationStale(job) ? (
                        <p className="mt-1 text-xs font-semibold text-accent">
                          No PPTX worker update was received for over 20 minutes. Retry the PPTX job to start a new worker.
                        </p>
                      ) : null}
                      {job.pptxStatus === 'failed' && job.pptxErrorMessage ? (
                        <p className="mt-1 text-xs font-semibold text-accent">PPTX generation failed: {job.pptxErrorMessage}</p>
                      ) : null}
                      {isLegacyCopyPlan(job) ? (
                        <p className="mt-1 text-xs font-semibold text-accent">
                          This job was created before Claude copy QA. Create a new deck from PPT Maker before exporting.
                        </p>
                      ) : null}
                      {job.errorMessage ? <p className="mt-1 text-xs font-semibold text-accent">{job.errorMessage}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        disabled={
                          isLegacyCopyPlan(job) || resumingJobId === job.id || exportingJobId === job.id || getRetryableItems(job).length === 0
                        }
                        onClick={() => void handleResumeJob(job)}
                      >
                        <Play className="h-4 w-4" />
                        Resume
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={
                          isLegacyCopyPlan(job)
                            ? !canRebuildLegacyJob(job)
                            : isPptxGenerationInProgress(job, exportingJobId) || job.status !== 'succeeded'
                        }
                        onClick={() => {
                          if (isLegacyCopyPlan(job)) {
                            handleRebuildLegacyJob(job);
                            return;
                          }
                          void handleGeneratePptx(job);
                        }}
                      >
                        <Download className="h-4 w-4" />
                        {isLegacyCopyPlan(job)
                          ? 'Rebuild in PPT Maker'
                          : isPptxGenerationInProgress(job, exportingJobId)
                            ? 'Generating PPTX'
                            : isPptxGenerationStale(job)
                              ? 'Retry PPTX'
                            : job.pptxUrl
                              ? 'Regenerate PPTX'
                              : 'Generate PPTX'}
                      </Button>
                      {job.pptxUrl && !isPptxGenerationInProgress(job, exportingJobId) ? (
                        <>
                          <a
                            href={getPptPreviewUrl(job.pptxUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text-main transition hover:bg-surface-muted"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Preview PPT
                          </a>
                          <a
                            href={job.pptxUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text-main transition hover:bg-surface-muted"
                          >
                            <Download className="h-4 w-4" />
                            Download PPTX
                          </a>
                        </>
                      ) : null}
                      <Button
                        variant="secondary"
                        disabled={deletingJobId === job.id || resumingJobId === job.id || exportingJobId === job.id}
                        onClick={() => void handleDelete(job)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto p-4">
                    {job.items.length === 0 ? (
                      <p className="text-sm text-text-subtle">No slide items recorded.</p>
                    ) : (
                      <div className="flex w-max gap-3 pr-4">
                        {job.items.map((item) => (
                          <div
                            key={item.id}
                            className="w-[276px] shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted"
                          >
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={`Generated slide ${item.pageNumber}`}
                                className="aspect-video w-full object-cover"
                              />
                            ) : (
                              <div className="flex aspect-video items-center justify-center text-xs font-semibold text-text-subtle">
                                No image
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-text-subtle">
                              <span>Slide {item.pageNumber}</span>
                              <Button
                                variant="ghost"
                                disabled={
                                  isLegacyCopyPlan(job) || retryingItemIds.includes(item.id) || queuedItemIds.includes(item.id) || resumingJobId === job.id || exportingJobId === job.id
                                }
                                onClick={() => void handleRetryItem(job.id, item)}
                                className="h-7 px-2 text-xs"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                {queuedItemIds.includes(item.id)
                                  ? 'Queued'
                                  : retryingItemIds.includes(item.id)
                                    ? 'Waiting / generating'
                                  : item.status === 'succeeded'
                                    ? 'Regenerate'
                                    : 'Retry'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
              <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-text-subtle">
                  Page {currentPage} of {pageCount} · {summary.jobs.length} projects
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={currentPage === pageCount}
                    onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function getRetryableItems(job: AdminGenerationJob): AdminGenerationItem[] {
  return job.items.filter((item) => item.status !== 'succeeded');
}

function isLegacyCopyPlan(job: AdminGenerationJob): boolean {
  const copyQa = job.deckPlan?.copyQa;
  return !copyQa || copyQa.status !== 'passed';
}

function canRebuildLegacyJob(job: AdminGenerationJob): boolean {
  return Boolean(job.deckPlan?.request?.sourceText.trim());
}

function getPptPreviewUrl(pptxUrl: string): string {
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(pptxUrl)}`;
}

function createImageDeckFromJob(job: AdminGenerationJob): GeneratedImageDeck {
  if (!job.deckPlan) {
    throw new Error('This job does not include the original deck plan.');
  }

  const images = job.items
    .slice()
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .map((item): GeneratedSlideImage => {
      const slide = job.deckPlan?.slides.find((candidate) => candidate.pageNumber === item.pageNumber);
      if (!item.imageUrl || !slide) {
        throw new Error(`Slide ${item.pageNumber} is missing image or deck plan data.`);
      }

      return {
        id: item.id,
        slideId: slide.id,
        pageNumber: item.pageNumber,
        title: slide.title,
        imageUrl: item.imageUrl,
        storagePath: item.outputPath ?? undefined,
        generationItemId: item.id,
        prompt: slide.imagePrompt,
        provider: 'openai',
      };
    });

  return {
    id: `image-deck-${job.id}`,
    deckPlanId: job.deckPlan.id,
    generationJobId: job.id,
    createdAt: new Date().toISOString(),
    images,
  };
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}
