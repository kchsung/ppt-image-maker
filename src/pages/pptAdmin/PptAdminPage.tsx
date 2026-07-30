import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Download, ExternalLink, RefreshCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { PptDomExportDeck } from '@/components/pptMaker/PptDomExportDeck';
import { PptHtmlSlide } from '@/components/pptMaker/PptHtmlSlide';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { enhancePptDocument } from '@/services/pptDocument.service';
import { pptExportService } from '@/services/pptExport.service';
import { pptAdminService } from '@/services/pptAdmin.service';
import type { AdminGenerationJob, AdminGenerationSummary } from '@/types/models/pptAdmin.model';

const STATUS_LABELS: Record<AdminGenerationJob['status'], string> = { pending: 'Pending', processing: 'Processing', succeeded: 'Succeeded', failed: 'Failed' };
const JOBS_PER_PAGE = 3;

export function PptAdminPage() {
  const [summary, setSummary] = useState<AdminGenerationSummary>({ jobs: [] });
  const [status, setStatus] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [exportingJobId, setExportingJobId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const isLoading = status === 'loading';
  const pageCount = Math.max(1, Math.ceil(summary.jobs.length / JOBS_PER_PAGE));
  const pagedJobs = useMemo(() => summary.jobs.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE), [currentPage, summary.jobs]);
  const totals = useMemo(() => ({ all: summary.jobs.length, succeeded: summary.jobs.filter((job) => job.status === 'succeeded').length, failed: summary.jobs.filter((job) => job.status === 'failed').length, processing: summary.jobs.filter((job) => job.status === 'processing' || job.status === 'pending').length }), [summary.jobs]);

  const loadJobs = useCallback(async (silent = false) => {
    if (!silent) setStatus('loading');
    try { setSummary(await pptAdminService.listGenerationJobs()); setStatus('idle'); }
    catch (error) { setStatus('failed'); toast.error(error instanceof Error ? error.message : 'Failed to load generation jobs.'); }
  }, []);

  useEffect(() => { void loadJobs(); }, [loadJobs]);
  useEffect(() => { setCurrentPage((page) => Math.min(page, pageCount)); }, [pageCount]);

  const handleDelete = async (job: AdminGenerationJob) => {
    if (!window.confirm(`Delete "${job.title}" and its generated PPT assets from Supabase?`)) return;
    setDeletingJobId(job.id);
    try { await pptAdminService.deleteGenerationJob(job.id); setSummary((current) => ({ jobs: current.jobs.filter((item) => item.id !== job.id) })); toast.success('Presentation deleted.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to delete generation job.'); }
    finally { setDeletingJobId(null); }
  };

  const handleGeneratePptx = async (job: AdminGenerationJob) => {
    if (!job.deckPlan) { toast.error('This project does not include the approved Slide JSON.'); return; }
    setExportingJobId(job.id);
    try {
      const enhancement = await enhancePptDocument(job.deckPlan);
      const exportRoot = document.querySelector<HTMLElement>(`[data-pptx-deck="${job.id}"]`);
      const elements = exportRoot ? Array.from(exportRoot.querySelectorAll<HTMLElement>('[data-pptx-slide]')) : [];
      const pptxBlob = await pptExportService.createDeckBlob(job.deckPlan, enhancement, elements);
      await pptAdminService.savePptxOutput(job.id, enhancement.fileName, pptxBlob);
      toast.success('Editable PPTX was created in this browser and saved to Supabase Storage.');
      await loadJobs();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to generate PPTX.'); }
    finally { setExportingJobId(null); }
  };

  return <><PageHeader eyebrow="QLEARN Startup" title="PPT List" description="Browse saved Slide JSON projects, review their editable layouts, and save finished PPTX files." actions={<Button variant="secondary" onClick={() => void loadJobs()} disabled={isLoading}><RefreshCcw className="h-4 w-4" />Refresh</Button>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-4"><SummaryTile label="Total" value={totals.all} /><SummaryTile label="Succeeded" value={totals.succeeded} /><SummaryTile label="Running" value={totals.processing} /><SummaryTile label="Failed" value={totals.failed} /></div>
    <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-bold text-primary">Saved presentations</h2><p className="mt-1 text-sm text-text-subtle">Latest 50 presentation projects are shown first. Showing {JOBS_PER_PAGE} projects per page.</p></div>{isLoading ? <Badge>Loading</Badge> : null}</div></CardHeader><CardContent>{summary.jobs.length === 0 ? <EmptyState /> : <div className="space-y-3">{pagedJobs.map((job) => <PresentationRow key={job.id} job={job} deleting={deletingJobId === job.id} exporting={exportingJobId === job.id} onDelete={handleDelete} onGenerate={handleGeneratePptx} />)}<Pagination currentPage={currentPage} pageCount={pageCount} projectCount={summary.jobs.length} onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))} onNext={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} /></div>}</CardContent></Card>
    {pagedJobs.map((job) => job.deckPlan ? <PptDomExportDeck key={`export-${job.id}`} deckPlan={job.deckPlan} deckId={job.id} /> : null)}</>;
}

function PresentationRow({ job, deleting, exporting, onDelete, onGenerate }: { job: AdminGenerationJob; deleting: boolean; exporting: boolean; onDelete: (job: AdminGenerationJob) => void; onGenerate: (job: AdminGenerationJob) => void }) {
  const canGenerate = Boolean(job.deckPlan) && !exporting && !deleting;
  const hasPlan = Boolean(job.deckPlan?.slides.length);
  return <article className="overflow-hidden rounded-md border border-border bg-surface"><div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-bold text-primary">{job.title}</h3><Badge>{STATUS_LABELS[job.status]}</Badge><Badge>{exporting ? 'PPTX Building' : job.pptxUrl ? 'PPTX Ready' : job.pptxStatus === 'failed' ? 'PPTX Failed' : 'PPTX Not Generated'}</Badge></div><p className="mt-1 text-xs text-text-subtle">{format(new Date(job.createdAt), 'yyyy-MM-dd HH:mm')} · {job.deckPlan?.slides.length ?? job.totalItems} slides · {job.progress}%</p>{exporting ? <p className="mt-2 text-xs font-semibold text-primary">Converting HTML/CSS layout to editable PPTX and uploading it to Supabase Storage.</p> : null}{job.pptxStatus === 'failed' && job.pptxErrorMessage ? <p className="mt-1 text-xs font-semibold text-accent">PPTX generation failed: {job.pptxErrorMessage}</p> : null}{job.errorMessage ? <p className="mt-1 text-xs font-semibold text-accent">{job.errorMessage}</p> : null}</div><div className="flex flex-wrap items-center gap-2"><Button variant="secondary" disabled={!canGenerate} onClick={() => void onGenerate(job)}><Download className="h-4 w-4" />{exporting ? 'Generating PPTX' : job.pptxUrl ? 'Regenerate PPTX' : 'Generate PPTX'}</Button>{job.pptxUrl && !exporting ? <><a href={getPptPreviewUrl(job.pptxUrl)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text-main transition hover:bg-surface-muted"><ExternalLink className="h-4 w-4" />Preview PPT</a><a href={job.pptxUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text-main transition hover:bg-surface-muted"><Download className="h-4 w-4" />Download PPTX</a></> : null}<Button variant="secondary" disabled={deleting || exporting} onClick={() => void onDelete(job)}><Trash2 className="h-4 w-4" />Delete</Button></div></div><div className="overflow-x-auto p-4">{hasPlan ? <div className="flex w-max gap-3 pr-4">{job.deckPlan?.slides.map((slide) => <div key={slide.id} className="w-[276px] shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted"><div className="h-[155px] overflow-hidden"><PptHtmlSlide slide={slide} logoImageDataUrl={job.deckPlan?.request.logoImageDataUrl} styleReference={job.deckPlan?.request.styleReference} previewScale={0.14375} /></div><div className="flex items-center justify-between px-3 py-2 text-xs text-text-subtle"><span>Slide {slide.pageNumber}</span><span>{slide.visualStructure}</span></div></div>)}</div> : <p className="text-sm text-text-subtle">No Slide JSON was recorded for this legacy project.</p>}</div></article>;
}

function EmptyState() { return <div className="rounded-md border border-dashed border-border bg-surface-muted p-8 text-center"><p className="text-sm font-semibold text-text-main">No saved presentations yet</p><p className="mt-1 text-sm text-text-subtle">Slide JSON projects and finished PPTX files will appear here.</p></div>; }
function Pagination({ currentPage, pageCount, projectCount, onPrevious, onNext }: { currentPage: number; pageCount: number; projectCount: number; onPrevious: () => void; onNext: () => void }) { return <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-text-subtle">Page {currentPage} of {pageCount} · {projectCount} projects</p><div className="flex items-center gap-2"><Button variant="secondary" disabled={currentPage === 1} onClick={onPrevious}><ChevronLeft className="h-4 w-4" />Previous</Button><Button variant="secondary" disabled={currentPage === pageCount} onClick={onNext}>Next<ChevronRight className="h-4 w-4" /></Button></div></div>; }
function SummaryTile({ label, value }: { label: string; value: number }) { return <div className="rounded-md border border-border bg-surface px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{label}</p><p className="mt-1 text-2xl font-bold text-primary">{value}</p></div>; }
function getPptPreviewUrl(pptxUrl: string): string { return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(pptxUrl)}`; }
