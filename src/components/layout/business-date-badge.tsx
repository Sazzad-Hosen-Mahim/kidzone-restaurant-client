import { useGetSettingsQuery } from '@/features/admin/admin-api';
import { useAuth } from '@/features/auth/use-auth';
import { formatBusinessDate, todayBusinessDate } from '@/lib/dates';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarDays } from 'lucide-react';

/**
 * The business date in the header.
 *
 * Worth the space because the business day is not always the calendar day: with
 * `businessDayStartHour` set, trade before that hour belongs to yesterday, and
 * a cashier ringing up at 01:00 needs to see which day their sale will land on.
 */
export function BusinessDateBadge() {
  const { can } = useAuth();
  // Only admins may read settings; everyone else gets the plain calendar date,
  // which is correct whenever the day starts at midnight.
  const { data: settings } = useGetSettingsQuery(undefined, { skip: !can.manageSettings });

  const today = todayBusinessDate();
  const startHour = settings?.businessDayStartHour ?? 0;
  const timezone = settings?.businessTimezone ?? 'Asia/Dhaka';

  const badge = (
    <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
      <CalendarDays className="size-4" />
      <span className="tabular hidden sm:inline">{formatBusinessDate(today)}</span>
    </div>
  );

  if (startHour === 0) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>
        The business day runs from {String(startHour).padStart(2, '0')}:00 ({timezone}). Trade before then counts
        toward the previous day.
      </TooltipContent>
    </Tooltip>
  );
}
