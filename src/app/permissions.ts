import type { Role, Section } from '@/types/api';

/**
 * The backend's permission matrix, mirrored.
 *
 * This exists to keep the UI honest: a button that leads to a guaranteed 403 is
 * worse than no button, because the user has no way to tell "I may not do this"
 * from "this is broken". The server remains the only thing that actually
 * enforces any of it — this is presentation, not security.
 */

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  KIDZONE_MANAGER: 'Kid Zone manager',
  RESTAURANT_CASHIER: 'Restaurant cashier',
};

export const ROLE_SHORT: Record<Role, string> = {
  ADMIN: 'Admin',
  KIDZONE_MANAGER: 'Kid Zone',
  RESTAURANT_CASHIER: 'Restaurant',
};

export const isAdmin = (role: Role | undefined): boolean => role === 'ADMIN';

/** Which sections a role may see at all. */
export function sectionsFor(role: Role | undefined): Section[] {
  switch (role) {
    case 'ADMIN':
      return ['KIDZONE', 'RESTAURANT'];
    case 'KIDZONE_MANAGER':
      return ['KIDZONE'];
    case 'RESTAURANT_CASHIER':
      return ['RESTAURANT'];
    default:
      return [];
  }
}

export function canSeeSection(role: Role | undefined, section: Section): boolean {
  return sectionsFor(role).includes(section);
}

export interface Capabilities {
  manageUsers: boolean;
  manageSettings: boolean;
  viewAuditLog: boolean;
  runJobs: boolean;

  managePlans: boolean;
  sellKidZone: boolean;
  viewChildData: boolean;
  manualCheckIn: boolean;

  manageMenu: boolean;
  toggleAvailability: boolean;
  takeOrders: boolean;

  voidTransactions: boolean;
  /** Discounts beyond `maxStaffDiscountPercent`. */
  unlimitedDiscount: boolean;

  closeOwnDay: boolean;
  reopenDay: boolean;

  viewKidZoneReports: boolean;
  viewRestaurantReports: boolean;
  /** Either section — what gates the Reports area itself. */
  viewAnyReports: boolean;
  /** Shared reports, the combined dashboard and file exports. */
  viewAllReports: boolean;
  exportReports: boolean;
  /** Staff may only ever look at today; history is an admin view. */
  historicalReports: boolean;
}

export function capabilitiesFor(role: Role | undefined): Capabilities {
  const admin = role === 'ADMIN';
  const kidzone = role === 'KIDZONE_MANAGER';
  const restaurant = role === 'RESTAURANT_CASHIER';

  return {
    manageUsers: admin,
    manageSettings: admin,
    viewAuditLog: admin,
    runJobs: admin,

    managePlans: admin,
    sellKidZone: admin || kidzone,
    viewChildData: admin || kidzone,
    manualCheckIn: admin,

    manageMenu: admin,
    toggleAvailability: admin || restaurant,
    takeOrders: admin || restaurant,

    voidTransactions: admin,
    unlimitedDiscount: admin,

    closeOwnDay: admin || kidzone || restaurant,
    reopenDay: admin,

    viewKidZoneReports: admin || kidzone,
    viewRestaurantReports: admin || restaurant,
    viewAnyReports: admin || kidzone || restaurant,
    viewAllReports: admin,
    exportReports: admin,
    historicalReports: admin,
  };
}

/** The section a non-admin belongs to, for defaulting a closing or a report. */
export function homeSectionFor(role: Role | undefined): Section | null {
  const sections = sectionsFor(role);
  return sections.length === 1 ? sections[0] : null;
}

/** Where a role lands after signing in — the screen they actually work on. */
export function landingRouteFor(role: Role | undefined): string {
  switch (role) {
    case 'ADMIN':
      return '/dashboard';
    case 'KIDZONE_MANAGER':
      return '/kidzone/checkin';
    case 'RESTAURANT_CASHIER':
      return '/restaurant/pos';
    default:
      return '/login';
  }
}
