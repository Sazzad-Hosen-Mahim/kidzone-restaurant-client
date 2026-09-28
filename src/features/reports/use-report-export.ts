import { useState } from 'react';
import { toast } from 'sonner';
import { downloadReport } from '@/lib/download';
import type { QueryParams } from '@/app/query-helpers';

/**
 * Downloading a report.
 *
 * Exports are admin-only server-side and are generated synchronously, so a long
 * range can take a moment. The hook tracks which format is in flight so the
 * button can say "Preparing…" rather than looking dead.
 */
export function useReportExport(path: string, fallbackName: string) {
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null);

  const run = async (format: 'xlsx' | 'pdf', params: QueryParams) => {
    setBusy(format);
    try {
      const result = await downloadReport(path, params, format, fallbackName);
      toast.success('Export ready', { description: result.fileName });
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  return { busy, run };
}
