import {
  BadgePercent,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  Coffee,
  CreditCard,
  DoorOpen,
  FileText,
  LayoutDashboard,
  ListOrdered,
  type LucideIcon,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Ticket,
  Timer,
  UsersRound,
  UtensilsCrossed,
} from 'lucide-react';
import type { Capabilities } from '@/app/permissions';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Whether this role sees the item at all. */
  when: (can: Capabilities) => boolean;
  /** Match child routes too, e.g. /kidzone/sales/:id. */
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * The sidebar, filtered by capability.
 *
 * Ordered by how often each role actually touches a screen rather than
 * alphabetically: a cashier's first item is the till, a Kid Zone manager's is
 * the gate.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, when: (can) => can.viewAllReports, end: true },
    ],
  },
  {
    label: 'Kid Zone',
    items: [
      { to: '/kidzone/checkin', label: 'Check in', icon: DoorOpen, when: (can) => can.sellKidZone },
      { to: '/kidzone/floor', label: 'On the floor', icon: Timer, when: (can) => can.sellKidZone },
      { to: '/kidzone/sell', label: 'Sell a plan', icon: Ticket, when: (can) => can.sellKidZone },
      { to: '/kidzone/memberships', label: 'Memberships', icon: CalendarCheck, when: (can) => can.sellKidZone },
      { to: '/kidzone/sales', label: 'Kid Zone sales', icon: Receipt, when: (can) => can.sellKidZone },
      { to: '/kidzone/visits', label: 'Visit log', icon: ClipboardList, when: (can) => can.sellKidZone },
      { to: '/kidzone/plans', label: 'Plans & prices', icon: BadgePercent, when: (can) => can.managePlans },
    ],
  },
  {
    label: 'Restaurant',
    items: [
      { to: '/restaurant/pos', label: 'Till', icon: ShoppingCart, when: (can) => can.takeOrders },
      { to: '/restaurant/orders', label: 'Orders', icon: ListOrdered, when: (can) => can.takeOrders },
      { to: '/restaurant/menu', label: 'Menu', icon: UtensilsCrossed, when: (can) => can.toggleAvailability },
    ],
  },
  {
    label: 'Shared',
    items: [
      { to: '/customers', label: 'Customers', icon: UsersRound, when: () => true },
      { to: '/closing', label: 'Day closing', icon: CreditCard, when: (can) => can.closeOwnDay },
      { to: '/reports', label: 'Reports', icon: BarChart3, when: (can) => can.viewAnyReports },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/users', label: 'Staff', icon: UsersRound, when: (can) => can.manageUsers },
      { to: '/admin/settings', label: 'Settings', icon: Settings, when: (can) => can.manageSettings },
      { to: '/admin/audit', label: 'Audit log', icon: ShieldCheck, when: (can) => can.viewAuditLog },
      { to: '/admin/operations', label: 'SMS & jobs', icon: FileText, when: (can) => can.runJobs },
    ],
  },
];

export function visibleGroups(can: Capabilities): NavGroup[] {
  return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => item.when(can)) })).filter(
    (group) => group.items.length > 0,
  );
}

export { Coffee };
