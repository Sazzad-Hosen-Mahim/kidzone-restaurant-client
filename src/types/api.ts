/**
 * The backend's contract, transcribed.
 *
 * Two conventions run through everything here:
 *
 *  - **Money is an integer number of poisha** (1 BDT = 100 poisha). A field
 *    named `…Amount`, `…Price`, `…Charge`, `revenue`, `subtotal` or `total` is
 *    always poisha. Never render one without `formatTaka`.
 *  - **A `businessDate` is a `YYYY-MM-DD` string**, not a Date. It is the
 *    business day in Asia/Dhaka, which is not necessarily the calendar day of
 *    the `createdAt` timestamp.
 */

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export interface ResponseMeta {
  timestamp: string;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  period?: ReportPeriod;
  summary?: SalesSummary;
}

/**
 * Totals over every row matching a sales/orders filter, not just the page.
 * Voided rows are kept out of `totalAmount` and reported on their own.
 */
export interface SalesSummary {
  count: number;
  totalAmount: number;
  voidedCount: number;
  voidedAmount: number;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** What the RTK Query endpoints hand to components for a list. */
export interface Paginated<T> {
  items: T[];
  meta: PaginatedMeta;
  /** Only on lists that send one, e.g. Kid Zone sales and restaurant orders. */
  summary?: SalesSummary;
}

export interface ApiError {
  statusCode: number;
  /** Stable machine-readable code — branch on this, never on `message`. */
  error: string;
  message: string;
  details?: unknown;
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ROLES = ['ADMIN', 'KIDZONE_MANAGER', 'RESTAURANT_CASHIER'] as const;
export type Role = (typeof ROLES)[number];

export const PAYMENT_METHODS = ['CASH', 'BKASH', 'NAGAD', 'CARD', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** These settle against a provider statement, so a reference is required. */
export const DIGITAL_METHODS: PaymentMethod[] = ['BKASH', 'NAGAD', 'CARD'];

export type Section = 'KIDZONE' | 'RESTAURANT';
export type PlanType = 'MEMBERSHIP' | 'SESSION';
export type SaleStatus = 'COMPLETED' | 'VOIDED';
export type OrderStatus = 'PAID' | 'VOIDED';
export type MembershipStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type VisitStatus = 'ACTIVE' | 'COMPLETED';
export type VerificationMethod = 'OTP' | 'QR' | 'GATEPASS' | 'MANUAL_OVERRIDE';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type CheckInMethod = 'OTP' | 'QR' | 'BOTH';
export type SmsStatus = 'QUEUED' | 'SENT' | 'FAILED';
export type SmsType = 'OTP' | 'GATEPASS' | 'EXPIRY_REMINDER' | 'RECEIPT' | 'OTHER';

export const RANGE_KEYS = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_year',
  'custom',
] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

// ---------------------------------------------------------------------------
// Auth & users
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  tokenType: string;
}

export interface Profile extends AuthUser {
  lastLoginAt: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface Settings {
  businessName: string;
  address: string;
  phone: string;
  receiptFooter: string;
  vatPercent: number;
  serviceChargePercent: number;
  maxStaffDiscountPercent: number;
  weekStartDay: number;
  businessDayStartHour: number;
  businessTimezone: string;
  expiryReminderDays: number[];
  checkInMethod: CheckInMethod;
  otpExpiryMinutes: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  otpMaxSendsPerHour: number;
  smsTemplateMembershipSold: string;
  smsTemplateGatepass: string;
  smsTemplateOtp: string;
  smsTemplateExpiryReminder: string;
  smsTemplateReceipt: string;
}

export interface SettingDescriptor {
  key: keyof Settings;
  default: unknown;
  description: string;
}

// ---------------------------------------------------------------------------
// Customers & children
// ---------------------------------------------------------------------------

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  childCount?: number;
  children?: Child[];
}

export interface Child {
  id: string;
  customerId: string;
  name: string;
  dateOfBirth: string;
  ageYears: number;
  gender: Gender | null;
  medicalNotes: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  isActive: boolean;
  createdAt: string;
}

/** What a restaurant cashier gets instead of a child record. */
export interface RedactedChild {
  id: string;
  customerId: string;
  redacted: true;
}

export function isRedactedChild(child: Child | RedactedChild): child is RedactedChild {
  return 'redacted' in child;
}

export interface CustomerDetail extends Customer {
  kidZone?: {
    memberships: Membership[];
    visits: Visit[];
    sales: KidZoneSaleSummary[];
    totalSpent: number;
  };
  restaurant: {
    orders: OrderSummary[];
    orderCount: number;
    totalSpent: number;
  };
}

// ---------------------------------------------------------------------------
// Kid Zone
// ---------------------------------------------------------------------------

export interface KidZonePlan {
  id: string;
  name: string;
  type: PlanType;
  /** Poisha. */
  price: number;
  durationDays: number | null;
  sessionMinutes: number | null;
  includesSnackBox: boolean;
  requiresVerification: boolean;
  overtimeBlockMinutes: number | null;
  /** Poisha per started overtime block. */
  overtimeRatePerBlock: number | null;
  gracePeriodMinutes: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  priceHistory?: PriceHistoryEntry[];
}

export interface PriceHistoryEntry {
  id: string;
  oldPrice: number;
  newPrice: number;
  changedAt: string;
  changedBy: { id: string; name: string };
}

export interface KidZoneSaleSummary {
  id: string;
  receiptNo: string;
  businessDate: string;
  planNameSnapshot: string;
  totalAmount: number;
  status: SaleStatus;
  createdAt: string;
}

export interface KidZoneSale {
  id: string;
  receiptNo: string;
  businessDate: string;
  customerId: string;
  childId: string;
  planId: string;
  planNameSnapshot: string;
  unitPriceSnapshot: number;
  discountAmount: number;
  discountReason: string | null;
  totalAmount: number;
  status: SaleStatus;
  soldById: string;
  voidedById: string | null;
  voidReason: string | null;
  voidedAt: string | null;
  createdAt: string;
  customer?: Pick<Customer, 'id' | 'name' | 'phone'>;
  child?: { id: string; name: string };
  soldBy?: { id: string; name: string };
  voidedBy?: { id: string; name: string } | null;
  payments?: Payment[];
  membership?: Membership | null;
  visits?: Visit[];
}

export interface Membership {
  id: string;
  customerId: string;
  childId: string;
  planId: string;
  saleId: string;
  startDate: string;
  endDate: string;
  status: MembershipStatus;
  renewedFromId: string | null;
  createdAt: string;
  /**
   * The gate credential, encoded into the printed QR card.
   *
   * Present **only** on the sale and renewal responses and on
   * `GET /kidzone/memberships/:id/qr`. Every list and detail read strips it,
   * because anyone holding it can check the child in.
   */
  qrToken?: string;
  /** Derived by the API against today's business date. */
  daysRemaining?: number;
  expiringSoon?: boolean;
  visitCount?: number;
  customer?: Pick<Customer, 'id' | 'name' | 'phone'>;
  child?: { id: string; name: string };
  plan?: Pick<KidZonePlan, 'id' | 'name' | 'durationDays'>;
}

export interface Visit {
  id: string;
  businessDate: string;
  customerId: string;
  childId: string;
  membershipId: string | null;
  saleId: string | null;
  gatepassNo: string;
  checkInAt: string;
  expectedCheckOutAt: string | null;
  checkOutAt: string | null;
  verificationMethod: VerificationMethod;
  overrideReason: string | null;
  overtimeMinutes: number;
  overtimeCharge: number;
  status: VisitStatus;
  createdAt: string;
  child?: { id: string; name: string; medicalNotes?: string | null };
  customer?: Pick<Customer, 'id' | 'name' | 'phone'>;
  sale?: { id: string; receiptNo: string; planNameSnapshot: string; plan?: Partial<KidZonePlan> } | null;
  membership?: { id: string; endDate: string; planId: string } | null;
  checkedInBy?: { id: string; name: string };
  checkedOutBy?: { id: string; name: string } | null;
}

/** A visit on the live board, with the timer already computed by the API. */
export interface ActiveVisit extends Visit {
  elapsedMinutes: number;
  /** Negative once the session has run over. Null for an open-ended membership visit. */
  remainingMinutes: number | null;
  isOvertime: boolean;
  withinGrace: boolean;
  projectedOvertimeMinutes: number;
  /** Poisha owed if they left right now. */
  projectedOvertimeCharge: number;
}

export interface MembershipSummary {
  id: string;
  planId: string;
  planName: string;
  startDate: string;
  endDate: string;
  status: MembershipStatus;
  daysRemaining: number;
  expiringSoon: boolean;
  usable: boolean;
  /** Why it cannot be used right now, when `usable` is false. */
  blockedReason: string | null;
}

export interface CheckInLookup {
  customer: { id: string; name: string; phone: string };
  children: Array<{
    id: string;
    name: string;
    ageYears: number;
    medicalNotes: string | null;
    hasActiveVisit: boolean;
    activeGatepassNo: string | null;
    memberships: MembershipSummary[];
  }>;
  checkInMethod: CheckInMethod;
}

export interface OtpSendResult {
  expiresAt: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  /** Present outside production only, so the flow can be exercised without a gateway. */
  devCode?: string;
}

export interface CheckInResult {
  visit: Visit;
  child: { id: string; name: string };
  membership: MembershipSummary;
  daysRemaining: number;
  expiringSoon: boolean;
}

export interface SaleResult {
  sale: KidZoneSale;
  membership: Membership | null;
  visit: Visit | null;
}

/**
 * Everything printed on a membership card.
 *
 * `qrToken` is the value to encode in the QR square, verbatim — it is the same
 * string `POST /kidzone/checkin/qr` expects back. Fetching one is audited, so
 * only ask for it when a card is actually being shown or printed.
 */
export interface QrCard {
  membershipId: string;
  qrToken: string;
  status: MembershipStatus;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  /** False when the gate would refuse this card today. */
  usable: boolean;
  blockedReason: string | null;
  child: { id: string; name: string };
  customer: { id: string; name: string; phone: string };
  plan: { id: string; name: string };
}

// ---------------------------------------------------------------------------
// Restaurant
// ---------------------------------------------------------------------------

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  sku: string | null;
  isAvailable: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  category?: { id: string; name: string };
  priceHistory?: PriceHistoryEntry[];
}

export interface MenuBoard {
  categories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    items: Array<{ id: string; name: string; description: string | null; price: number; sku: string | null }>;
  }>;
  itemCount: number;
}

export type MenuBoardItem = MenuBoard['categories'][number]['items'][number];

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  itemNameSnapshot: string;
  unitPriceSnapshot: number;
  categoryNameSnapshot: string;
  quantity: number;
  lineTotal: number;
  note: string | null;
}

export interface OrderSummary {
  id: string;
  receiptNo: string;
  businessDate: string;
  totalAmount: number;
  status: OrderStatus;
  tableNo: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  receiptNo: string;
  businessDate: string;
  customerId: string | null;
  tableNo: string | null;
  subtotal: number;
  discountAmount: number;
  discountReason: string | null;
  /** Snapshotted at order time — not necessarily today's setting. */
  vatPercent: number;
  vatAmount: number;
  serviceChargePercent: number;
  serviceChargeAmount: number;
  totalAmount: number;
  status: OrderStatus;
  cashierId: string;
  voidedById: string | null;
  voidReason: string | null;
  voidedAt: string | null;
  createdAt: string;
  items: OrderItem[];
  payments: Payment[];
  customer?: Pick<Customer, 'id' | 'name' | 'phone'> | null;
  cashier?: { id: string; name: string };
  voidedBy?: { id: string; name: string } | null;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
  kidZoneSaleId: string | null;
  orderId: string | null;
  visitId: string | null;
  receivedById: string;
  businessDate: string;
  createdAt: string;
}

export interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

export interface ReceiptDocument {
  kind: 'KIDZONE_SALE' | 'RESTAURANT_ORDER' | 'GATEPASS';
  business: { name: string; address: string; phone: string; footer: string };
  receiptNo: string;
  businessDate: string;
  /** Pre-rendered in the business timezone, ready to print. */
  issuedAt: string;
  issuedAtIso: string;
  timezone: string;
  customer: { name: string; phone: string } | null;
  tableNo?: string | null;
  lines: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    note?: string | null;
    category?: string;
  }>;
  totals: {
    subtotal: number;
    discountAmount: number;
    discountReason?: string | null;
    serviceChargePercent?: number;
    serviceChargeAmount?: number;
    vatPercent?: number;
    vatAmount?: number;
    totalAmount: number;
  };
  payments: Array<{ method: string; amount: number; reference: string | null }>;
  servedBy: string;
  voided: { isVoided: boolean; reason?: string | null; voidedAt?: string | null; voidedBy?: string | null };
  gatepass?: {
    gatepassNo: string;
    childName: string;
    planName: string;
    checkInAt: string;
    expectedCheckOutAt: string | null;
    checkOutAt: string | null;
    status: VisitStatus;
    /** The gatepass number — deliberately not the membership QR token. */
    qrPayload: string;
    overtimeMinutes: number;
    overtimeCharge: number;
  };
}

// ---------------------------------------------------------------------------
// Day closing
// ---------------------------------------------------------------------------

export interface ClosingPreview {
  section: Section;
  businessDate: string;
  totalSales: number;
  transactionCount: number;
  expectedByMethod: Record<PaymentMethod, number>;
  expectedCash: number;
  totalDiscounts: number;
  voidCount: number;
  totalVoids: number;
  overtimeRevenue: number;
  isClosed: boolean;
  closing: DayClosing | null;
}

export interface DayClosing {
  id: string;
  section: Section;
  businessDate: string;
  expectedCash: number;
  countedCash: number;
  /** countedCash - expectedCash. Negative means the drawer was short. */
  difference: number;
  expectedByMethod: Record<string, number>;
  totalSales: number;
  totalVoids: number;
  totalDiscounts: number;
  transactionCount: number;
  notes: string | null;
  closedById: string;
  closedAt: string;
  reopenedAt: string | null;
  reopenReason: string | null;
  hasDifference?: boolean;
  isReopened?: boolean;
  closedBy?: { id: string; name: string };
}

// ---------------------------------------------------------------------------
// Audit & jobs
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: { id: string; name: string; role: Role } | null;
}

export interface SmsLogEntry {
  id: string;
  phone: string;
  type: SmsType;
  message: string;
  provider: string;
  status: SmsStatus;
  providerMessageId: string | null;
  error: string | null;
  attempts: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface ReportPeriod {
  range: RangeKey;
  from: string;
  to: string;
  days: number;
  previous: { from: string; to: string };
  timezone: string;
}

export interface ComparedMetric {
  current: number;
  previous: number;
  /** Null when the previous period was zero, i.e. there is no baseline. */
  change: number | null;
}

export interface VoidsBlock {
  count: number;
  total: number;
  previousCount: number;
  previousTotal: number;
}

export interface KidZoneSummary {
  revenue: ComparedMetric;
  salesCount: ComparedMetric;
  newMemberships: ComparedMetric;
  renewals: ComparedMetric;
  sessionsSold: ComparedMetric;
  overtimeRevenue: ComparedMetric;
  discounts: ComparedMetric;
  visits: ComparedMetric;
  averageSaleValue: ComparedMetric;
  voids: VoidsBlock;
}

export interface RestaurantSummary {
  revenue: ComparedMetric;
  orderCount: ComparedMetric;
  averageOrderValue: ComparedMetric;
  subtotal: ComparedMetric;
  vatCollected: ComparedMetric;
  serviceCharge: ComparedMetric;
  discounts: ComparedMetric;
  itemsSold: ComparedMetric;
  voids: VoidsBlock;
}

export interface TrendPoint {
  period: string;
  revenue: number;
  count: number;
}

export interface RevenueTrend {
  granularity: 'day' | 'month';
  points: TrendPoint[];
  byPlan?: Array<{ planName: string; points: Array<{ period: string; revenue: number }> }>;
}

export interface PlanBreakdown {
  planName: string;
  count: number;
  revenue: number;
  discounts: number;
  averageValue: number;
  revenueShare: number;
}

export interface VisitsReport {
  points: Array<{ period: string; member: number; session: number; total: number }>;
  totals: { member: number; session: number; total: number };
}

export interface PeakHoursReport {
  grid: Array<{ dayOfWeek: number; dayName: string; hour: number; visits: number }>;
  busiestDay: { dayOfWeek: number; dayName: string; visits: number } | null;
  busiestHour: { hour: number; visits: number } | null;
  totalVisits: number;
}

export interface UtilizationRow {
  membershipId: string;
  customerName: string;
  customerPhone: string;
  childName: string;
  planName: string;
  startDate: string;
  endDate: string;
  visits: number;
  elapsedDays: number;
  visitsPerWeek: number;
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
}

export interface UtilizationReport {
  memberships: UtilizationRow[];
  lowUsage: UtilizationRow[];
  averageVisitsPerWeek: number;
}

export interface MembersReport {
  activeCount: number;
  expiringIn7Days: number;
  expiringIn30Days: number;
  expiringSoon: Array<{
    membershipId: string;
    customerName: string;
    customerPhone: string;
    childName: string;
    planName: string;
    endDate: string;
    daysRemaining: number;
  }>;
  lapsedWithoutRenewal: Array<{
    membershipId: string;
    customerName: string;
    customerPhone: string;
    childName: string;
    planName: string;
    endDate: string;
    daysSinceExpiry: number;
    totalVisits: number;
  }>;
  lapsedCount: number;
}

export interface TopItem {
  itemName: string;
  categoryName: string;
  quantity: number;
  revenue: number;
  orderLines: number;
}

export interface TopItemsReport {
  byQuantity: TopItem[];
  byRevenue: TopItem[];
}

export interface CategoryBreakdown {
  categoryName: string;
  quantity: number;
  revenue: number;
  revenueShare: number;
}

export interface HourlyReport {
  hours: Array<{ hour: number; orders: number; revenue: number }>;
  peakHour: { hour: number; orders: number; revenue: number } | null;
}

export interface CashierPerformance {
  cashierId: string;
  cashierName: string;
  role: Role | null;
  orders: number;
  revenue: number;
  averageOrderValue: number;
  discounts: number;
  voidCount: number;
  voidTotal: number;
}

export interface PaymentMethodsReport {
  methods: Array<{ method: PaymentMethod; count: number; total: number; share: number }>;
  total: number;
}

export interface DiscountRow {
  section: Section;
  id: string;
  receiptNo: string;
  businessDate: string;
  at: string;
  by: { id: string; name: string; role: Role } | null;
  customer: { name: string; phone: string } | null;
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  totalAmount: number;
  reason: string | null;
}

export interface VoidRow {
  section: Section;
  id: string;
  receiptNo: string;
  businessDate: string;
  at: string | null;
  voidedBy: { id: string; name: string; role: Role } | null;
  soldBy: { id: string; name: string } | null;
  customer: { name: string; phone: string } | null;
  amount: number;
  reason: string | null;
}

export interface DiscountsVoidsReport {
  discounts: DiscountRow[];
  voids: VoidRow[];
  totals: { discountCount: number; discountAmount: number; voidCount: number; voidAmount: number };
  byStaff: Array<{
    staffId: string;
    name: string;
    discountCount: number;
    discountAmount: number;
    voidCount: number;
    voidAmount: number;
  }>;
}

export interface CrossSectionReport {
  customers: Array<{
    customerId: string;
    name: string;
    phone: string;
    kidZoneSpend: number;
    kidZoneTransactions: number;
    restaurantSpend: number;
    restaurantTransactions: number;
    totalSpend: number;
  }>;
  summary: {
    crossSectionCustomers: number;
    kidZoneCustomers: number;
    restaurantCustomers: number;
    crossoverRate: number;
    totalSpend: number;
    kidZoneSpend: number;
    restaurantSpend: number;
    averageSpendPerCustomer: number;
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardData {
  businessDate: string;
  timezone: string;
  today: {
    kidZone: { revenue: ComparedMetric; transactions: ComparedMetric };
    restaurant: { revenue: ComparedMetric; transactions: ComparedMetric };
    combined: { revenue: ComparedMetric; transactions: ComparedMetric };
  };
  liveFloor: {
    activeVisitCount: number;
    overtimeVisitCount: number;
    owedOvertimeTotal: number;
    visits: DashboardVisit[];
    overtimeVisits: DashboardVisit[];
  };
  membershipsExpiringThisWeek: {
    weekStart: string;
    weekEnd: string;
    count: number;
    memberships: Array<{
      membershipId: string;
      customerName: string;
      customerPhone: string;
      childName: string;
      planName: string;
      endDate: string;
    }>;
  };
  topDishesToday: Array<{ itemName: string; quantity: number; revenue: number }>;
  last7Days: Array<{
    businessDate: string;
    kidZoneRevenue: number;
    kidZoneTransactions: number;
    restaurantRevenue: number;
    restaurantTransactions: number;
    totalRevenue: number;
  }>;
}

export interface DashboardVisit {
  visitId: string;
  gatepassNo: string;
  childName: string;
  guardianName: string;
  guardianPhone: string;
  planName: string;
  checkInAt: string;
  elapsedMinutes: number;
  remainingMinutes: number | null;
  isOvertime: boolean;
  owedOvertime: number;
}

export interface HealthReport {
  status: 'ok' | 'error' | 'shutting_down';
  info: Record<string, { status: 'up' | 'down'; responseTimeMs?: number; message?: string }>;
  error: Record<string, unknown>;
  details: Record<string, { status: 'up' | 'down'; responseTimeMs?: number; message?: string }>;
}
