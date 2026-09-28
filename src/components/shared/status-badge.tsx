import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  MembershipStatus,
  OrderStatus,
  PaymentMethod,
  Role,
  SaleStatus,
  SmsStatus,
  VerificationMethod,
  VisitStatus,
} from '@/types/api';
import { ROLE_SHORT } from '@/app/permissions';

/**
 * Status pills.
 *
 * Colour carries meaning consistently across the app: green is settled and
 * fine, red is voided or short, amber wants attention, grey is inert history.
 */

const TONE = {
  success: 'border-transparent bg-success/12 text-success',
  danger: 'border-transparent bg-destructive/12 text-destructive',
  warning: 'border-transparent bg-warning/15 text-warning-foreground dark:text-warning',
  info: 'border-transparent bg-primary/12 text-primary',
  muted: 'border-transparent bg-muted text-muted-foreground',
} as const;

type Tone = keyof typeof TONE;

function Pill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn(TONE[tone], 'font-medium', className)}>
      {children}
    </Badge>
  );
}

export function SaleStatusBadge({ status }: { status: SaleStatus | OrderStatus }) {
  const voided = status === 'VOIDED';
  return <Pill tone={voided ? 'danger' : 'success'}>{voided ? 'Voided' : status === 'PAID' ? 'Paid' : 'Completed'}</Pill>;
}

export function MembershipStatusBadge({
  status,
  daysRemaining,
  expiringSoon,
}: {
  status: MembershipStatus;
  daysRemaining?: number;
  expiringSoon?: boolean;
}) {
  if (status === 'CANCELLED') return <Pill tone="danger">Cancelled</Pill>;
  if (status === 'EXPIRED') return <Pill tone="muted">Expired</Pill>;

  if (expiringSoon) {
    return (
      <Pill tone="warning">
        {daysRemaining !== undefined ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left` : 'Expiring soon'}
      </Pill>
    );
  }

  return <Pill tone="success">{daysRemaining !== undefined ? `${daysRemaining} days left` : 'Active'}</Pill>;
}

export function VisitStatusBadge({ status, isOvertime }: { status: VisitStatus; isOvertime?: boolean }) {
  if (status === 'COMPLETED') return <Pill tone="muted">Checked out</Pill>;
  if (isOvertime) return <Pill tone="danger">Overtime</Pill>;
  return <Pill tone="success">Inside</Pill>;
}

const VERIFICATION_LABELS: Record<VerificationMethod, { label: string; tone: Tone }> = {
  OTP: { label: 'OTP', tone: 'info' },
  QR: { label: 'QR', tone: 'info' },
  GATEPASS: { label: 'Gatepass', tone: 'muted' },
  MANUAL_OVERRIDE: { label: 'Manual override', tone: 'warning' },
};

export function VerificationBadge({ method }: { method: VerificationMethod }) {
  const { label, tone } = VERIFICATION_LABELS[method];
  return <Pill tone={tone}>{label}</Pill>;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  CARD: 'Card',
  OTHER: 'Other',
};

export function paymentMethodLabel(method: PaymentMethod | string): string {
  return METHOD_LABELS[method as PaymentMethod] ?? method;
}

export function PaymentMethodBadge({ method }: { method: PaymentMethod | string }) {
  return <Pill tone={method === 'CASH' ? 'success' : 'info'}>{paymentMethodLabel(method)}</Pill>;
}

export function RoleBadge({ role }: { role: Role }) {
  return <Pill tone={role === 'ADMIN' ? 'info' : 'muted'}>{ROLE_SHORT[role]}</Pill>;
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return <Pill tone={isActive ? 'success' : 'muted'}>{isActive ? 'Active' : 'Inactive'}</Pill>;
}

export function AvailabilityBadge({ isAvailable }: { isAvailable: boolean }) {
  return <Pill tone={isAvailable ? 'success' : 'warning'}>{isAvailable ? 'Available' : 'Out of stock'}</Pill>;
}

export function SmsStatusBadge({ status }: { status: SmsStatus }) {
  const tone: Tone = status === 'SENT' ? 'success' : status === 'FAILED' ? 'danger' : 'warning';
  return <Pill tone={tone}>{status.charAt(0) + status.slice(1).toLowerCase()}</Pill>;
}

export { Pill };
