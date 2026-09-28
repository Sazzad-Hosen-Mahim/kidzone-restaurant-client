import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/page';
import { MembershipStatusBadge, Pill } from '@/components/shared/status-badge';
import { QrScanner } from '@/components/shared/qr-scanner';
import { useAuth } from '@/features/auth/use-auth';
import {
  useCheckInLookupMutation,
  useCheckInManualMutation,
  useCheckInQrMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
} from './kidzone-api';
import { errorCode, errorDetails, errorMessage } from '@/app/api-error';
import { formatPhone, isValidBdPhone, PHONE_ERROR } from '@/lib/phone';
import { formatBusinessDate } from '@/lib/dates';
import type { CheckInLookup, CheckInResult, MembershipSummary } from '@/types/api';
import { CheckInSuccess } from './checkin-success';
import { AlertCircle, DoorOpen, Loader2, QrCode, Search, ShieldAlert, Smartphone, TriangleAlert } from 'lucide-react';

/**
 * The gate.
 *
 * Built around the physical sequence: a guardian gives their phone number, the
 * staff member sees who is on the account and whether the membership is usable,
 * and only then picks how to verify. Anything that blocks entry — an expired
 * membership, a child already inside — is shown at the lookup step, before a
 * code is sent, so nobody is asked for an OTP that was never going to work.
 */
export function CheckInPage() {
  const [phone, setPhone] = useState('');
  const [lookup, { data: result, isLoading: isLooking, error: lookupError, reset: resetLookup }] =
    useCheckInLookupMutation();
  const [success, setSuccess] = useState<CheckInResult | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidBdPhone(phone)) return;
    setSuccess(null);
    await lookup({ phone }).unwrap().catch(() => undefined);
  };

  const startOver = () => {
    setPhone('');
    setSuccess(null);
    resetLookup();
    phoneRef.current?.focus();
  };

  if (success) {
    return <CheckInSuccess result={success} onDone={startOver} />;
  }

  const phoneInvalid = phone.length > 0 && !isValidBdPhone(phone);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Check in"
        description="Look up a guardian by phone, then verify with a code, a QR card, or an override."
      />

      <Card>
        <CardContent>
          <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="lookup-phone">Guardian's phone number</Label>
              <Input
                id="lookup-phone"
                ref={phoneRef}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="01712345678"
                inputMode="tel"
                autoComplete="off"
                autoFocus
                className="tabular text-lg"
                aria-invalid={phoneInvalid}
              />
              {phoneInvalid ? <p className="text-destructive text-sm">{PHONE_ERROR}</p> : null}
            </div>

            <Button type="submit" size="lg" disabled={!isValidBdPhone(phone) || isLooking}>
              {isLooking ? <Loader2 className="animate-spin" /> : <Search />}
              Look up
            </Button>
          </form>
        </CardContent>
      </Card>

      {lookupError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>
            {errorCode(lookupError) === 'CUSTOMER_NOT_FOUND' ? 'No customer with that number' : 'Lookup failed'}
          </AlertTitle>
          <AlertDescription>
            {errorCode(lookupError) === 'CUSTOMER_NOT_FOUND'
              ? 'They may not be registered yet. Sell them a plan to create the record.'
              : errorMessage(lookupError)}
          </AlertDescription>
        </Alert>
      ) : null}

      {result ? <LookupResult lookup={result} onCheckedIn={setSuccess} onReset={startOver} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function LookupResult({
  lookup,
  onCheckedIn,
  onReset,
}: {
  lookup: CheckInLookup;
  onCheckedIn: (result: CheckInResult) => void;
  onReset: () => void;
}) {
  const [selectedChildId, setSelectedChildId] = useState<string | null>(lookup.children[0]?.id ?? null);

  const [chosenMembershipId, setChosenMembershipId] = useState<string | null>(null);

  const child = lookup.children.find((candidate) => candidate.id === selectedChildId) ?? null;
  const usable = child?.memberships.filter((membership) => membership.usable) ?? [];
  const unusable = child?.memberships.filter((membership) => !membership.usable) ?? [];

  /*
   * Default to the first usable membership, so the common case — one child with
   * one live membership — needs no extra taps.
   *
   * Derived during render rather than synced by an effect. An explicit choice
   * only counts while it still belongs to the selected child, which means
   * switching child resets the selection for free, with no effect and no extra
   * render pass.
   */
  const selectedMembershipId =
    chosenMembershipId && usable.some((candidate) => candidate.id === chosenMembershipId)
      ? chosenMembershipId
      : (usable[0]?.id ?? null);

  const membership = child?.memberships.find((candidate) => candidate.id === selectedMembershipId) ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{lookup.customer.name}</CardTitle>
          <CardDescription className="tabular">{formatPhone(lookup.customer.phone)}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Who is going in?</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {lookup.children.map((candidate) => {
                const isSelected = candidate.id === selectedChildId;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setSelectedChildId(candidate.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{candidate.name}</p>
                        <p className="text-muted-foreground text-xs">{candidate.ageYears} years old</p>
                      </div>
                      {candidate.hasActiveVisit ? <Pill tone="warning">Inside</Pill> : null}
                    </div>

                    {candidate.medicalNotes ? (
                      <p className="text-warning-foreground dark:text-warning mt-2 flex items-start gap-1 text-xs">
                        <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                        {candidate.medicalNotes}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {child?.hasActiveVisit ? (
            <Alert>
              <DoorOpen />
              <AlertTitle>{child.name} is already inside</AlertTitle>
              <AlertDescription>
                Gatepass <span className="tabular font-medium">{child.activeGatepassNo}</span>. Check them out from
                the floor screen before checking them in again.
              </AlertDescription>
            </Alert>
          ) : null}

          {child && child.memberships.length === 0 ? (
            <Alert>
              <AlertCircle />
              <AlertTitle>No membership on file</AlertTitle>
              <AlertDescription>
                {child.name} has no membership. Sell a plan, or ring up a one-time session which checks them straight
                in.
              </AlertDescription>
            </Alert>
          ) : null}

          {child && child.memberships.length > 0 ? (
            <div className="space-y-2">
              <Label>Membership</Label>
              <div className="space-y-2">
                {usable.map((candidate) => (
                  <MembershipOption
                    key={candidate.id}
                    membership={candidate}
                    selected={candidate.id === selectedMembershipId}
                    onSelect={() => setChosenMembershipId(candidate.id)}
                  />
                ))}
                {unusable.map((candidate) => (
                  <MembershipOption key={candidate.id} membership={candidate} selected={false} disabled />
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {child && membership?.usable && !child.hasActiveVisit ? (
        <VerificationPanel
          phone={lookup.customer.phone}
          childId={child.id}
          membership={membership}
          allowedMethod={lookup.checkInMethod}
          onCheckedIn={onCheckedIn}
        />
      ) : null}

      <Button type="button" variant="ghost" onClick={onReset}>
        Look up someone else
      </Button>
    </div>
  );
}

function MembershipOption({
  membership,
  selected,
  disabled,
  onSelect,
}: {
  membership: MembershipSummary;
  selected: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
        disabled
          ? 'bg-muted/40 cursor-not-allowed opacity-70'
          : selected
            ? 'border-primary bg-primary/5'
            : 'hover:bg-accent'
      }`}
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{membership.planName}</p>
        <p className="text-muted-foreground text-xs">
          {formatBusinessDate(membership.startDate)} – {formatBusinessDate(membership.endDate)}
        </p>
        {membership.blockedReason ? (
          <p className="text-destructive mt-0.5 text-xs">{membership.blockedReason}</p>
        ) : null}
      </div>
      <MembershipStatusBadge
        status={membership.status}
        daysRemaining={membership.usable ? membership.daysRemaining : undefined}
        expiringSoon={membership.expiringSoon}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------

function VerificationPanel({
  phone,
  childId,
  membership,
  allowedMethod,
  onCheckedIn,
}: {
  phone: string;
  childId: string;
  membership: MembershipSummary;
  allowedMethod: CheckInLookup['checkInMethod'];
  onCheckedIn: (result: CheckInResult) => void;
}) {
  const { can } = useAuth();
  const otpAllowed = allowedMethod === 'BOTH' || allowedMethod === 'OTP';
  const qrAllowed = allowedMethod === 'BOTH' || allowedMethod === 'QR';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify</CardTitle>
        <CardDescription>
          Confirm the guardian is the one checking {membership.planName} in.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue={otpAllowed ? 'otp' : qrAllowed ? 'qr' : 'manual'}>
          <TabsList className="w-full">
            {otpAllowed ? (
              <TabsTrigger value="otp" className="flex-1">
                <Smartphone className="size-4" /> Code by SMS
              </TabsTrigger>
            ) : null}
            {qrAllowed ? (
              <TabsTrigger value="qr" className="flex-1">
                <QrCode className="size-4" /> QR card
              </TabsTrigger>
            ) : null}
            {can.manualCheckIn ? (
              <TabsTrigger value="manual" className="flex-1">
                <ShieldAlert className="size-4" /> Override
              </TabsTrigger>
            ) : null}
          </TabsList>

          {otpAllowed ? (
            <TabsContent value="otp" className="pt-4">
              <OtpFlow phone={phone} childId={childId} membershipId={membership.id} onCheckedIn={onCheckedIn} />
            </TabsContent>
          ) : null}

          {qrAllowed ? (
            <TabsContent value="qr" className="pt-4">
              <QrFlow childId={childId} onCheckedIn={onCheckedIn} />
            </TabsContent>
          ) : null}

          {can.manualCheckIn ? (
            <TabsContent value="manual" className="pt-4">
              <ManualFlow membershipId={membership.id} childId={childId} onCheckedIn={onCheckedIn} />
            </TabsContent>
          ) : null}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function OtpFlow({
  phone,
  childId,
  membershipId,
  onCheckedIn,
}: {
  phone: string;
  childId: string;
  membershipId: string;
  onCheckedIn: (result: CheckInResult) => void;
}) {
  const [sendOtp, { data: sent, isLoading: isSending, error: sendError }] = useSendOtpMutation();
  const [verifyOtp, { isLoading: isVerifying, error: verifyError }] = useVerifyOtpMutation();
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // The API enforces a resend cooldown; counting it down here means the button
  // is simply unavailable rather than failing when pressed.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async () => {
    const result = await sendOtp({ phone }).unwrap().catch(() => null);
    if (!result) return;
    setCooldown(result.resendAfterSeconds);
    setCode('');
    toast.success(`Code sent to ${formatPhone(phone)}`, {
      description: `It expires in ${Math.round(result.expiresInSeconds / 60)} minutes.`,
    });
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await verifyOtp({ phone, code, childId, membershipId }).unwrap().catch(() => null);
    if (result) onCheckedIn(result);
  };

  const attemptsLeft = errorDetails<{ attemptsRemaining?: number }>(verifyError)?.attemptsRemaining;

  return (
    <div className="space-y-4">
      {!sent ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            A 6-digit code will be texted to {formatPhone(phone)}.
          </p>
          <Button type="button" onClick={() => void send()} disabled={isSending}>
            {isSending ? <Loader2 className="animate-spin" /> : <Smartphone />}
            Send code
          </Button>
        </div>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          {/* Outside production the API returns the code so the flow can be
              exercised without a live SMS gateway. */}
          {sent.devCode ? (
            <Alert>
              <AlertCircle />
              <AlertTitle>Development mode</AlertTitle>
              <AlertDescription>
                No SMS gateway is configured, so the code is <strong className="tabular">{sent.devCode}</strong>.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="otp-code">Code from the guardian's phone</Label>
            <Input
              id="otp-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              autoFocus
              className="tabular max-w-[200px] text-center text-2xl tracking-[0.3em]"
            />
          </div>

          {verifyError ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>
                {errorMessage(verifyError)}
                {attemptsLeft !== undefined && attemptsLeft <= 2 ? (
                  <span className="mt-1 block text-xs">
                    After {attemptsLeft} more wrong {attemptsLeft === 1 ? 'try' : 'tries'} the code is cancelled and
                    you will need a new one.
                  </span>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={code.length !== 6 || isVerifying}>
              {isVerifying ? <Loader2 className="animate-spin" /> : <DoorOpen />}
              Check in
            </Button>
            <Button type="button" variant="outline" onClick={() => void send()} disabled={cooldown > 0 || isSending}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </Button>
          </div>
        </form>
      )}

      {sendError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{errorMessage(sendError)}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

/**
 * Check-in by QR, three ways into the same call.
 *
 * The camera covers a guardian holding a printed card. The text field stays
 * because it covers the two cases a camera cannot: a handheld USB scanner,
 * which simply types what it reads, and a guardian who left the card at home
 * but still has the code in their SMS.
 */
function QrFlow({ childId, onCheckedIn }: { childId: string; onCheckedIn: (result: CheckInResult) => void }) {
  const [checkInQr, { isLoading, error }] = useCheckInQrMutation();
  const [token, setToken] = useState('');

  const checkIn = async (qrToken: string) => {
    const result = await checkInQr({ qrToken, childId }).unwrap().catch(() => null);
    if (result) onCheckedIn(result);
  };

  return (
    <div className="space-y-3">
      <QrScanner
        disabled={isLoading}
        onScan={(value) => {
          // Shown in the field as well, so a code that the gate then refuses is
          // visible rather than having vanished with the camera.
          setToken(value);
          void checkIn(value);
        }}
      />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-muted-foreground text-xs">or enter it</span>
        <Separator className="flex-1" />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void checkIn(token.trim());
        }}
        className="space-y-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="qr-token">QR code</Label>
          <Input
            id="qr-token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Scan the card, or paste the code from the SMS"
            autoComplete="off"
            className="font-mono text-sm"
          />
          <p className="text-muted-foreground text-xs">
            A handheld scanner types into this field and submits on its own.
          </p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={token.trim().length < 10 || isLoading}>
          {isLoading ? <Loader2 className="animate-spin" /> : <QrCode />}
          Check in
        </Button>
      </form>
    </div>
  );
}

function ManualFlow({
  membershipId,
  childId,
  onCheckedIn,
}: {
  membershipId: string;
  childId: string;
  onCheckedIn: (result: CheckInResult) => void;
}) {
  const [checkInManual, { isLoading, error }] = useCheckInManualMutation();
  const [reason, setReason] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await checkInManual({ membershipId, childId, reason: reason.trim() })
      .unwrap()
      .catch(() => null);
    if (result) onCheckedIn(result);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Alert>
        <ShieldAlert />
        <AlertTitle>This skips verification</AlertTitle>
        <AlertDescription>
          For a dead phone or an SMS outage. It is recorded in the audit log against your name, so write a reason
          someone reading it next month will understand. Expired and cancelled memberships are still refused.
        </AlertDescription>
      </Alert>

      <div className="space-y-1.5">
        <Label htmlFor="override-reason">Reason</Label>
        <Input
          id="override-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Guardian's phone is switched off"
          maxLength={300}
          autoFocus
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      ) : null}

      <Separator />

      <Button type="submit" variant="secondary" disabled={reason.trim().length < 5 || isLoading}>
        {isLoading ? <Loader2 className="animate-spin" /> : <ShieldAlert />}
        Override and check in
      </Button>
    </form>
  );
}
