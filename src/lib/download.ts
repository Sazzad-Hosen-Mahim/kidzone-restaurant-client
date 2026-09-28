import { API_BASE_URL } from '@/app/base-query';
import { store } from '@/app/store';
import { toQueryString, type QueryParams } from '@/app/query-helpers';

/**
 * Downloading a file from the API.
 *
 * RTK Query is not used for these: the responses are binary, they are never
 * cached, and the whole point is a Save dialog rather than state. They still
 * have to carry the bearer token and the refresh cookie, so a plain anchor to
 * the URL would not work — hence fetch-then-object-URL.
 */

export interface DownloadResult {
  fileName: string;
  sizeBytes: number;
}

async function authorizedFetch(path: string, accept: string): Promise<Response> {
  const token = store.getState().auth.accessToken;

  return fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      accept,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
}

/** Pulls the server's suggested name out of Content-Disposition. */
function fileNameFrom(response: Response, fallback: string): string {
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? `Download failed (${response.status})`;
  } catch {
    return `Download failed (${response.status})`;
  }
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers; a tick is
  // enough for the click to have been handled.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads a report export. Admin only, server-side. */
export async function downloadReport(
  path: string,
  params: QueryParams,
  format: 'xlsx' | 'pdf',
  fallbackName: string,
): Promise<DownloadResult> {
  const accept =
    format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf';

  const response = await authorizedFetch(`${path}${toQueryString({ ...params, export: format })}`, accept);
  if (!response.ok) throw new Error(await readError(response));

  const blob = await response.blob();
  const fileName = fileNameFrom(response, `${fallbackName}.${format}`);
  saveBlob(blob, fileName);

  return { fileName, sizeBytes: blob.size };
}

/**
 * Opens a receipt PDF in a new tab so it can be sent straight to the thermal
 * printer, rather than landing in the downloads folder.
 */
export async function openReceiptPdf(kind: string, id: string, receiptNo: string): Promise<void> {
  const response = await authorizedFetch(`/receipts/${kind}/${id}?format=pdf`, 'application/pdf');
  if (!response.ok) throw new Error(await readError(response));

  const url = URL.createObjectURL(await response.blob());
  const opened = window.open(url, '_blank', 'noopener,noreferrer');

  if (!opened) {
    // Popup blocked: fall back to saving it, which is better than silently
    // doing nothing when the cashier expected paper.
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${receiptNo}.pdf`;
    anchor.click();
  }

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
