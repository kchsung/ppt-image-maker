import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { RefreshCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { pptAdminService } from '@/services/pptAdmin.service';
import type { AdminGenerationJob, AdminGenerationSummary } from '@/types/models/pptAdmin.model';

const STATUS_LABELS: Record<AdminGenerationJob['status'], string> = {
  pending: 'Pending',
  processing: 'Processing',
  succeeded: 'Succeeded',
  failed: 'Failed',
};

export function PptAdminPage() {
  const [summary, setSummary] = useState<AdminGenerationSummary>({ jobs: [] });
  const [status, setStatus] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const isLoading = status === 'loading';

  const totals = useMemo(
    () => ({
      all: summary.jobs.length,
      succeeded: summary.jobs.filter((job) => job.status === 'succeeded').length,
      failed: summary.jobs.filter((job) => job.status === 'failed').length,
      processing: summary.jobs.filter((job) => job.status === 'processing' || job.status === 'pending').length,
    }),
    [summary.jobs],
  );

  const loadJobs = async () => {
    setStatus('loading');
    try {
      setSummary(await pptAdminService.listGenerationJobs());
      setStatus('idle');
    } catch (error) {
      setStatus('failed');
      toast.error(error instanceof Error ? error.message : 'Failed to load generation jobs.');
    }
  };

  useEffect(() => {
    void loadJobs();
  }, []);

  const handleDelete = async (job: AdminGenerationJob) => {
    const shouldDelete = window.confirm(
      `Delete "${job.title}" and ${job.items.length} generated image file(s) from Supabase?`,
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
      toast.success('Generation job deleted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete generation job.');
    } finally {
      setDeletingJobId(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="QLEARN Startup"
        title="PPT Generation Admin"
        description="Review generated PPT image jobs stored in Supabase and remove completed or failed runs with their Storage files."
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
              <h2 className="text-base font-bold text-primary">Generation jobs</h2>
              <p className="mt-1 text-sm text-text-subtle">Latest 50 Supabase jobs are shown first.</p>
            </div>
            {isLoading ? <Badge>Loading</Badge> : null}
          </div>
        </CardHeader>
        <CardContent>
          {summary.jobs.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-surface-muted p-8 text-center">
              <p className="text-sm font-semibold text-text-main">No generated PPT jobs yet</p>
              <p className="mt-1 text-sm text-text-subtle">Generated slide image jobs will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {summary.jobs.map((job) => (
                <article key={job.id} className="rounded-md border border-border bg-surface">
                  <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-primary">{job.title}</h3>
                        <Badge>{STATUS_LABELS[job.status]}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-text-subtle">
                        {format(new Date(job.createdAt), 'yyyy-MM-dd HH:mm')} · {job.completedItems}/{job.totalItems} slides ·
                        {job.progress}%
                      </p>
                      {job.errorMessage ? <p className="mt-1 text-xs font-semibold text-accent">{job.errorMessage}</p> : null}
                    </div>
                    <Button
                      variant="secondary"
                      disabled={deletingJobId === job.id}
                      onClick={() => void handleDelete(job)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                  <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                    {job.items.length === 0 ? (
                      <p className="text-sm text-text-subtle">No slide items recorded.</p>
                    ) : (
                      job.items.map((item) => (
                        <div key={item.id} className="overflow-hidden rounded-md border border-border bg-surface-muted">
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
                            <span>{item.status}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}
