import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page';
import { Money } from '@/components/shared/money';
import { ActiveBadge, Pill } from '@/components/shared/status-badge';
import { TakaInput } from '@/components/shared/taka-input';
import {
  useCreatePlanMutation,
  useDeletePlanMutation,
  useListPlansQuery,
  useUpdatePlanMutation,
} from './kidzone-api';
import { errorMessage } from '@/app/api-error';
import { formatInstant } from '@/lib/dates';
import type { KidZonePlan, PlanType } from '@/types/api';
import { Archive, Loader2, Plus, TrendingUp } from 'lucide-react';

export function PlansPage() {
  const query = useListPlansQuery({ limit: 100 });
  const [editing, setEditing] = useState<KidZonePlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [retiring, setRetiring] = useState<KidZonePlan | null>(null);
  const [deletePlan, deleteState] = useDeletePlanMutation();

  const columns: Array<Column<KidZonePlan>> = [
    {
      key: 'name',
      header: 'Plan',
      cell: (plan) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{plan.name}</p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <span>{plan.type === 'MEMBERSHIP' ? `${plan.durationDays} days` : `${plan.sessionMinutes} minutes`}</span>
            {plan.includesSnackBox ? <span>· snack box</span> : null}
            {plan.requiresVerification ? <span>· verified entry</span> : null}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (plan) => (
        <Pill tone={plan.type === 'MEMBERSHIP' ? 'info' : 'muted'}>
          {plan.type === 'MEMBERSHIP' ? 'Membership' : 'Session'}
        </Pill>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      numeric: true,
      cell: (plan) => <Money value={plan.price} className="font-medium" />,
    },
    {
      key: 'overtime',
      header: 'Overtime',
      hideOnMobile: true,
      cell: (plan) =>
        plan.overtimeRatePerBlock ? (
          <span className="text-muted-foreground text-sm">
            <Money value={plan.overtimeRatePerBlock} symbol={false} /> per {plan.overtimeBlockMinutes}m,{' '}
            {plan.gracePeriodMinutes}m grace
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    { key: 'isActive', header: 'Status', cell: (plan) => <ActiveBadge isActive={plan.isActive} /> },
    {
      key: 'actions',
      header: '',
      numeric: true,
      cell: (plan) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(plan)}>
            Edit
          </Button>
          {plan.isActive ? (
            <Button variant="ghost" size="icon" aria-label="Retire plan" onClick={() => setRetiring(plan)}>
              <Archive className="text-destructive size-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans &amp; prices"
        description="Changing a price never alters a sale already made — each sale keeps its own snapshot."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New plan
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(plan) => plan.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle="No plans yet"
        emptyDescription="Create a membership or session plan to start selling."
      />

      {creating ? <PlanDialog onOpenChange={(open) => !open && setCreating(false)} /> : null}
      {editing ? <PlanDialog plan={editing} onOpenChange={(open) => !open && setEditing(null)} /> : null}

      <AlertDialog open={retiring !== null} onOpenChange={(open) => !open && setRetiring(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire {retiring?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It stops appearing on the sales screen. Memberships already sold keep running to their end date, and
              past sales are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteState.isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteState.isLoading}
              onClick={async (event) => {
                event.preventDefault();
                if (!retiring) return;
                const result = await deletePlan(retiring.id).unwrap().catch(() => null);
                if (result) {
                  toast.success(`${retiring.name} retired`);
                  setRetiring(null);
                }
              }}
            >
              {deleteState.isLoading ? <Loader2 className="animate-spin" /> : null}
              Retire plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PlanDialog({ plan, onOpenChange }: { plan?: KidZonePlan; onOpenChange: (open: boolean) => void }) {
  const isEdit = plan !== undefined;
  const [createPlan, createState] = useCreatePlanMutation();
  const [updatePlan, updateState] = useUpdatePlanMutation();
  const state = isEdit ? updateState : createState;

  const [form, setForm] = useState({
    name: plan?.name ?? '',
    type: (plan?.type ?? 'SESSION') as PlanType,
    price: plan?.price ?? 0,
    durationDays: plan?.durationDays ?? 90,
    sessionMinutes: plan?.sessionMinutes ?? 120,
    includesSnackBox: plan?.includesSnackBox ?? false,
    requiresVerification: plan?.requiresVerification ?? false,
    overtimeBlockMinutes: plan?.overtimeBlockMinutes ?? 30,
    overtimeRatePerBlock: plan?.overtimeRatePerBlock ?? 0,
    gracePeriodMinutes: plan?.gracePeriodMinutes ?? 10,
    sortOrder: plan?.sortOrder ?? 0,
    isActive: plan?.isActive ?? true,
  });

  const priceChanged = isEdit && form.price !== plan.price;

  const submit = async () => {
    const body = {
      name: form.name.trim(),
      type: form.type,
      price: form.price,
      ...(form.type === 'MEMBERSHIP' ? { durationDays: form.durationDays } : { sessionMinutes: form.sessionMinutes }),
      includesSnackBox: form.includesSnackBox,
      requiresVerification: form.requiresVerification,
      gracePeriodMinutes: form.gracePeriodMinutes,
      sortOrder: form.sortOrder,
      ...(form.type === 'SESSION' && form.overtimeRatePerBlock > 0
        ? { overtimeBlockMinutes: form.overtimeBlockMinutes, overtimeRatePerBlock: form.overtimeRatePerBlock }
        : {}),
    };

    const result = isEdit
      ? await updatePlan({ id: plan.id, body: { ...body, isActive: form.isActive } }).unwrap().catch(() => null)
      : await createPlan(body).unwrap().catch(() => null);

    if (result) {
      toast.success(isEdit ? `${result.name} updated` : `${result.name} created`);
      onOpenChange(false);
    }
  };

  const valid =
    form.name.trim().length >= 2 &&
    form.price >= 0 &&
    (form.type === 'MEMBERSHIP' ? form.durationDays >= 1 : form.sessionMinutes >= 1);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${plan.name}` : 'New plan'}</DialogTitle>
          <DialogDescription>
            A membership runs for a number of days; a session runs for a number of minutes and can charge overtime.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(state.error)}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="plan-name">Name</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="3 Month Membership"
                maxLength={120}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm({
                    ...form,
                    type: value as PlanType,
                    // Memberships default to verified entry; a walk-in session
                    // is already standing at the counter.
                    requiresVerification: value === 'MEMBERSHIP',
                  })
                }
              >
                <SelectTrigger id="plan-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBERSHIP">Membership</SelectItem>
                  <SelectItem value="SESSION">Session</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-price">Price</Label>
              <TakaInput id="plan-price" value={form.price} onChange={(price) => setForm({ ...form, price })} />
            </div>

            {form.type === 'MEMBERSHIP' ? (
              <div className="space-y-1.5">
                <Label htmlFor="plan-duration">Duration (days)</Label>
                <Input
                  id="plan-duration"
                  type="number"
                  min={1}
                  max={3650}
                  value={form.durationDays}
                  onChange={(event) => setForm({ ...form, durationDays: Number(event.target.value) })}
                  className="tabular"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="plan-minutes">Session length (minutes)</Label>
                <Input
                  id="plan-minutes"
                  type="number"
                  min={1}
                  max={1440}
                  value={form.sessionMinutes}
                  onChange={(event) => setForm({ ...form, sessionMinutes: Number(event.target.value) })}
                  className="tabular"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="plan-sort">Display order</Label>
              <Input
                id="plan-sort"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
                className="tabular"
              />
            </div>
          </div>

          {form.type === 'SESSION' ? (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium">Overtime</p>
                <p className="text-muted-foreground text-xs">
                  Charged in whole started blocks once the session plus the grace period is exceeded. Leave the rate
                  at zero for no overtime charge.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-grace">Grace (minutes)</Label>
                    <Input
                      id="plan-grace"
                      type="number"
                      min={0}
                      max={240}
                      value={form.gracePeriodMinutes}
                      onChange={(event) => setForm({ ...form, gracePeriodMinutes: Number(event.target.value) })}
                      className="tabular"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-block">Block (minutes)</Label>
                    <Input
                      id="plan-block"
                      type="number"
                      min={1}
                      max={720}
                      value={form.overtimeBlockMinutes}
                      onChange={(event) => setForm({ ...form, overtimeBlockMinutes: Number(event.target.value) })}
                      className="tabular"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-rate">Rate per block</Label>
                    <TakaInput
                      id="plan-rate"
                      value={form.overtimeRatePerBlock}
                      onChange={(value) => setForm({ ...form, overtimeRatePerBlock: value })}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <Separator />

          <div className="space-y-3">
            <ToggleRow
              label="Includes a snack box"
              checked={form.includesSnackBox}
              onChange={(checked) => setForm({ ...form, includesSnackBox: checked })}
            />
            <ToggleRow
              label="Requires verified entry at the gate"
              hint="OTP or QR rather than a gatepass"
              checked={form.requiresVerification}
              onChange={(checked) => setForm({ ...form, requiresVerification: checked })}
            />
            {isEdit ? (
              <ToggleRow
                label="On sale"
                checked={form.isActive}
                onChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            ) : null}
          </div>

          {priceChanged ? (
            <Alert>
              <TrendingUp />
              <AlertDescription>
                The price change is recorded in the plan's price history and the audit log. Sales already made keep
                their own price.
              </AlertDescription>
            </Alert>
          ) : null}

          {isEdit && plan.priceHistory && plan.priceHistory.length > 0 ? (
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">Recent price changes</p>
              {plan.priceHistory.slice(0, 3).map((entry) => (
                <p key={entry.id} className="text-muted-foreground text-xs">
                  <Money value={entry.oldPrice} symbol={false} /> → <Money value={entry.newPrice} symbol={false} /> ·{' '}
                  {entry.changedBy.name} · {formatInstant(entry.changedAt, 'd MMM yyyy')}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={state.isLoading}>
            Cancel
          </Button>
          <Button type="button" disabled={!valid || state.isLoading} onClick={() => void submit()}>
            {state.isLoading ? <Loader2 className="animate-spin" /> : null}
            {isEdit ? 'Save changes' : 'Create plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
