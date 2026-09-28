import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, ErrorState } from '@/components/shared/page';
import { useGetSettingsQuery, useUpdateSettingsMutation } from './admin-api';
import { errorMessage } from '@/app/api-error';
import { DAY_NAMES } from '@/lib/dates';
import type { CheckInMethod, Settings } from '@/types/api';
import { AlertCircle, Info, Loader2, Save } from 'lucide-react';

/**
 * Business settings.
 *
 * Only the fields the user actually changed are sent: the API patches by key,
 * and sending the whole object back would overwrite a setting someone else
 * changed in the meantime.
 */
export function SettingsPage() {
  const { data: settings, isLoading, error, refetch } = useGetSettingsQuery();
  const [updateSettings, { isLoading: isSaving, error: saveError }] = useUpdateSettingsMutation();

  const [draft, setDraft] = useState<Partial<Settings>>({});

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading || !settings) return <Skeleton className="h-96 w-full rounded-xl" />;

  const merged: Settings = { ...settings, ...draft };
  const changedKeys = (Object.keys(draft) as Array<keyof Settings>).filter(
    (key) => JSON.stringify(draft[key]) !== JSON.stringify(settings[key]),
  );
  const dirty = changedKeys.length > 0;

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    const patch = Object.fromEntries(changedKeys.map((key) => [key, merged[key]])) as Partial<Settings>;
    const result = await updateSettings(patch).unwrap().catch(() => null);
    if (result) {
      toast.success('Settings saved', {
        description: `${changedKeys.length} setting${changedKeys.length === 1 ? '' : 's'} updated.`,
      });
      setDraft({});
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Every change is recorded in the audit log with its before and after value."
        actions={
          <Button type="button" onClick={() => void save()} disabled={!dirty || isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            {dirty ? `Save ${changedKeys.length} change${changedKeys.length === 1 ? '' : 's'}` : 'Saved'}
          </Button>
        }
      />

      {saveError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{errorMessage(saveError)}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="business">
        <TabsList>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="money">Money</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="checkin">Check-in</TabsTrigger>
          <TabsTrigger value="sms">SMS templates</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Business details</CardTitle>
              <CardDescription>Printed at the top and bottom of every receipt.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name">
                <Input value={merged.businessName} onChange={(e) => set('businessName', e.target.value)} maxLength={120} />
              </Field>
              <Field label="Contact phone">
                <Input value={merged.phone} onChange={(e) => set('phone', e.target.value)} maxLength={60} />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Input value={merged.address} onChange={(e) => set('address', e.target.value)} maxLength={300} />
              </Field>
              <Field label="Receipt footer" className="sm:col-span-2">
                <Input
                  value={merged.receiptFooter}
                  onChange={(e) => set('receiptFooter', e.target.value)}
                  maxLength={300}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="money" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Charges and discounts</CardTitle>
              <CardDescription>
                A restaurant bill is worked out as subtotal → discount → service charge → VAT, so the discount
                reduces the charges as well as the food, and VAT applies to the service charge.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field label="VAT %" hint="Applied after the service charge">
                <PercentInput value={merged.vatPercent} onChange={(value) => set('vatPercent', value)} />
              </Field>
              <Field label="Service charge %" hint="Applied after the discount">
                <PercentInput
                  value={merged.serviceChargePercent}
                  onChange={(value) => set('serviceChargePercent', value)}
                />
              </Field>
              <Field label="Staff discount limit %" hint="Admins are not limited">
                <PercentInput
                  value={merged.maxStaffDiscountPercent}
                  onChange={(value) => set('maxStaffDiscountPercent', value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Alert>
            <Info />
            <AlertDescription>
              Changing these does not affect bills already taken — each order stores the percentages that applied at
              the time, so old receipts reprint exactly as they were.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Business day and week</CardTitle>
              <CardDescription>These decide which day a sale belongs to and how weekly reports are cut.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field label="Timezone">
                <Input
                  value={merged.businessTimezone}
                  onChange={(e) => set('businessTimezone', e.target.value)}
                  placeholder="Asia/Dhaka"
                />
              </Field>

              <Field label="Day starts at" hint="Trade before this hour counts as the previous day">
                <Select
                  value={String(merged.businessDayStartHour)}
                  onValueChange={(value) => set('businessDayStartHour', Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, hour) => (
                      <SelectItem key={hour} value={String(hour)}>
                        {String(hour).padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Week starts on">
                <Select value={String(merged.weekStartDay)} onValueChange={(value) => set('weekStartDay', Number(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_NAMES.map((day, index) => (
                      <SelectItem key={day} value={String(index)}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          {merged.businessDayStartHour > 0 ? (
            <Alert>
              <Info />
              <AlertDescription>
                With the day starting at {String(merged.businessDayStartHour).padStart(2, '0')}:00, a sale rung up at
                02:30 counts toward the previous business day.
              </AlertDescription>
            </Alert>
          ) : null}
        </TabsContent>

        <TabsContent value="checkin" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Gate check-in</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Accepted methods">
                <Select
                  value={merged.checkInMethod}
                  onValueChange={(value) => set('checkInMethod', value as CheckInMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOTH">OTP and QR</SelectItem>
                    <SelectItem value="OTP">OTP only</SelectItem>
                    <SelectItem value="QR">QR only</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Expiry reminders" hint="Days before expiry, comma separated">
                <Input
                  value={merged.expiryReminderDays.join(', ')}
                  onChange={(event) =>
                    set(
                      'expiryReminderDays',
                      event.target.value
                        .split(',')
                        .map((part) => Number(part.trim()))
                        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 365),
                    )
                  }
                  placeholder="7, 1"
                />
              </Field>

              <Field label="OTP lifetime (minutes)">
                <NumberInput
                  value={merged.otpExpiryMinutes}
                  min={1}
                  max={60}
                  onChange={(value) => set('otpExpiryMinutes', value)}
                />
              </Field>
              <Field label="Wrong attempts before it is cancelled">
                <NumberInput
                  value={merged.otpMaxAttempts}
                  min={1}
                  max={10}
                  onChange={(value) => set('otpMaxAttempts', value)}
                />
              </Field>
              <Field label="Resend cooldown (seconds)">
                <NumberInput
                  value={merged.otpResendCooldownSeconds}
                  min={0}
                  max={600}
                  onChange={(value) => set('otpResendCooldownSeconds', value)}
                />
              </Field>
              <Field label="Codes per number per hour">
                <NumberInput
                  value={merged.otpMaxSendsPerHour}
                  min={1}
                  max={50}
                  onChange={(value) => set('otpMaxSendsPerHour', value)}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms" className="space-y-4 pt-4">
          <Alert>
            <Info />
            <AlertDescription>
              Placeholders in curly braces are filled in when the message is sent. A placeholder the system does not
              recognise is left as-is, so a typo shows up in the SMS log rather than as the word "undefined" in a
              customer's inbox.
            </AlertDescription>
          </Alert>

          <Card>
            <CardContent className="space-y-4">
              <TemplateField
                label="Membership sold"
                value={merged.smsTemplateMembershipSold}
                onChange={(value) => set('smsTemplateMembershipSold', value)}
                placeholders="{name} {child} {plan} {endDate} {qrCode} {businessName}"
              />
              <TemplateField
                label="Gatepass"
                value={merged.smsTemplateGatepass}
                onChange={(value) => set('smsTemplateGatepass', value)}
                placeholders="{name} {child} {gatepassNo} {checkInTime} {expectedCheckOut} {businessName}"
              />
              <TemplateField
                label="Check-in code"
                value={merged.smsTemplateOtp}
                onChange={(value) => set('smsTemplateOtp', value)}
                placeholders="{otp} {minutes} {businessName}"
              />
              <TemplateField
                label="Expiry reminder"
                value={merged.smsTemplateExpiryReminder}
                onChange={(value) => set('smsTemplateExpiryReminder', value)}
                placeholders="{name} {child} {plan} {endDate} {daysLeft} {businessName}"
              />
              <TemplateField
                label="Receipt"
                value={merged.smsTemplateReceipt}
                onChange={(value) => set('smsTemplateReceipt', value)}
                placeholders="{receiptNo} {amount} {date} {businessName}"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

function PercentInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="relative">
      <Input
        type="number"
        min={0}
        max={100}
        step={0.5}
        value={value}
        onChange={(event) => onChange(Math.max(0, Math.min(100, Number(event.target.value))))}
        className="tabular pr-8"
      />
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
        %
      </span>
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value))))}
      className="tabular"
    />
  );
}

function TemplateField({
  label,
  value,
  onChange,
  placeholders,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholders: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={2} maxLength={600} />
      <p className="text-muted-foreground font-mono text-xs">{placeholders}</p>
    </div>
  );
}
