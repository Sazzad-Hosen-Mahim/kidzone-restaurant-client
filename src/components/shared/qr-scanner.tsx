import { Suspense, lazy, useState } from 'react';
// Type-only, so the package itself stays out of the main chunk — see `Scanner`
// below. A value import here would silently defeat the lazy load.
import type { IScannerError } from '@yudiel/react-qr-scanner';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Camera, CameraOff, Loader2 } from 'lucide-react';

/**
 * Loaded on first use rather than with the app.
 *
 * The scanner drags in a barcode-detection ponyfill for browsers without a
 * native `BarcodeDetector`, which is a large payload to put in front of every
 * screen — including the till, which never scans anything. Since the camera is
 * opt-in per check-in, the import can wait until someone actually taps it.
 */
const Scanner = lazy(() =>
  import('@yudiel/react-qr-scanner').then((module) => ({ default: module.Scanner })),
);

/**
 * Why each camera failure gets its own sentence.
 *
 * The browser's own messages are written for developers, and at the gate the
 * difference between "nobody granted permission" and "this tablet is on plain
 * HTTP so the camera is unavailable at all" decides whether staff retry or
 * reach for the manual field instead.
 */
function describeError(error: IScannerError): { title: string; detail: string } {
  switch (error.kind) {
    case 'permission-denied':
      return {
        title: 'Camera permission was refused',
        detail:
          'Allow camera access for this site in the browser’s address bar, then try again. The code can also be typed in below.',
      };
    case 'no-camera':
      return { title: 'No camera found', detail: 'This device has no camera the browser can use.' };
    case 'in-use':
      return {
        title: 'The camera is busy',
        detail: 'Another tab or app is holding it. Close that and try again.',
      };
    case 'insecure-context':
      return {
        title: 'The camera needs a secure connection',
        detail:
          'Browsers only allow camera access over HTTPS or on localhost. Type the code in below, or serve this tablet over HTTPS.',
      };
    case 'unsupported':
      return {
        title: 'This browser cannot scan',
        detail: 'It has no barcode support. Use a handheld scanner or type the code in below.',
      };
    default:
      return { title: 'The camera could not start', detail: error.message };
  }
}

/**
 * A QR scanner that stays off until asked.
 *
 * Deliberately not auto-starting: mounting a live camera would throw a
 * permission prompt at staff on every single check-in, keep the lens warm all
 * shift, and — on a tablet served over plain HTTP — fail in a way that looks
 * like the app is broken. So the camera is opt-in per check-in, and closes the
 * moment a code is read.
 */
export function QrScanner({
  onScan,
  disabled,
  className,
}: {
  /** Called once per successful read; the camera stops before it fires. */
  onScan: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<IScannerError | null>(null);

  if (!active) {
    return (
      <div className={cn('space-y-2', className)}>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={disabled}
          onClick={() => {
            setError(null);
            setActive(true);
          }}
        >
          <Camera /> Scan with the camera
        </Button>

        {error ? <ScanError error={error} /> : null}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-lg border">
        <Suspense
          fallback={
            <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Starting the camera…
            </div>
          }
        >
          <Scanner
            formats={['qr_code']}
            onScan={(codes) => {
              const value = codes[0]?.rawValue?.trim();
              if (!value) return;
              // Close the camera before handing the value up, so a slow
              // check-in request does not leave the lens running behind a
              // spinner.
              setActive(false);
              onScan(value);
            }}
            onError={(cause) => {
              setError(cause);
              setActive(false);
            }}
            sound={false}
            components={{ finder: true }}
            styles={{ container: { width: '100%', height: '100%' } }}
          />
        </Suspense>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 py-1.5 text-center text-xs text-white">
          Hold the card in the frame
        </div>
      </div>

      <Button type="button" variant="ghost" className="w-full" onClick={() => setActive(false)}>
        <CameraOff /> Stop the camera
      </Button>
    </div>
  );
}

function ScanError({ error }: { error: IScannerError }) {
  const { title, detail } = describeError(error);

  return (
    <Alert variant="destructive">
      <CameraOff />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{detail}</AlertDescription>
    </Alert>
  );
}
