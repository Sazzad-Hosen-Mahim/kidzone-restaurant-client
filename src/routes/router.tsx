import { Suspense, lazy } from 'react';
import { Navigate, createBrowserRouter, Outlet } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { RequireAuth, RequireCapability } from './guards';
import { LoginPage } from '@/features/auth/login-page';
import { RouteFallback } from './route-fallback';
import { NotFoundPage } from './not-found-page';
import { LandingRedirect } from './landing-redirect';

/**
 * Route-level code splitting.
 *
 * The screens staff use all shift — the till, the gate, check-in — are in the
 * main bundle. Reports and the admin area, which carry Recharts and the heavy
 * tables, are split off so a cashier's tablet never downloads them.
 */
const lazyPage = <T extends Record<string, React.ComponentType>>(
  loader: () => Promise<T>,
  name: keyof T & string,
) =>
  lazy(async () => {
    const module = await loader();
    return { default: module[name] };
  });

const DashboardPage = lazyPage(() => import('@/features/dashboard/dashboard-page'), 'DashboardPage');
const ReportsPage = lazyPage(() => import('@/features/reports/reports-page'), 'ReportsPage');
const UsersPage = lazyPage(() => import('@/features/admin/users-page'), 'UsersPage');
const SettingsPage = lazyPage(() => import('@/features/admin/settings-page'), 'SettingsPage');
const AuditPage = lazyPage(() => import('@/features/admin/audit-page'), 'AuditPage');
const OperationsPage = lazyPage(() => import('@/features/admin/operations-page'), 'OperationsPage');
const PlansPage = lazyPage(() => import('@/features/kidzone/plans-page'), 'PlansPage');
const MenuPage = lazyPage(() => import('@/features/restaurant/menu-page'), 'MenuPage');

// Kept eager: these are the working screens.
import { CheckInPage } from '@/features/kidzone/checkin-page';
import { FloorPage } from '@/features/kidzone/floor-page';
import { SellPlanPage } from '@/features/kidzone/sell-plan-page';
import { MembershipsPage } from '@/features/kidzone/memberships-page';
import { KidZoneSalesPage } from '@/features/kidzone/sales-page';
import { VisitsPage } from '@/features/kidzone/visits-page';
import { PosPage } from '@/features/restaurant/pos-page';
import { OrdersPage } from '@/features/restaurant/orders-page';
import { CustomersPage } from '@/features/customers/customers-page';
import { CustomerDetailPage } from '@/features/customers/customer-detail-page';
import { ClosingPage } from '@/features/closing/closing-page';
import { ReceiptPage } from '@/features/receipts/receipt-page';

function SuspendedOutlet() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },

  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            element: <SuspendedOutlet />,
            children: [
              { index: true, element: <LandingRedirect /> },

              // -------------------------------------------------- overview
              {
                element: <RequireCapability capability="viewAllReports" />,
                children: [{ path: 'dashboard', element: <DashboardPage /> }],
              },

              // -------------------------------------------------- Kid Zone
              {
                element: <RequireCapability capability="sellKidZone" />,
                children: [
                  { path: 'kidzone/checkin', element: <CheckInPage /> },
                  { path: 'kidzone/floor', element: <FloorPage /> },
                  { path: 'kidzone/sell', element: <SellPlanPage /> },
                  { path: 'kidzone/memberships', element: <MembershipsPage /> },
                  { path: 'kidzone/sales', element: <KidZoneSalesPage /> },
                  { path: 'kidzone/visits', element: <VisitsPage /> },
                ],
              },
              {
                element: <RequireCapability capability="managePlans" />,
                children: [{ path: 'kidzone/plans', element: <PlansPage /> }],
              },

              // ------------------------------------------------ restaurant
              {
                element: <RequireCapability capability="takeOrders" />,
                children: [
                  { path: 'restaurant/pos', element: <PosPage /> },
                  { path: 'restaurant/orders', element: <OrdersPage /> },
                ],
              },
              {
                element: <RequireCapability capability="toggleAvailability" />,
                children: [{ path: 'restaurant/menu', element: <MenuPage /> }],
              },

              // ---------------------------------------------------- shared
              { path: 'customers', element: <CustomersPage /> },
              { path: 'customers/:id', element: <CustomerDetailPage /> },
              { path: 'receipts/:kind/:id', element: <ReceiptPage /> },

              {
                element: <RequireCapability capability="closeOwnDay" />,
                children: [{ path: 'closing', element: <ClosingPage /> }],
              },
              {
                element: <RequireCapability capability="viewAnyReports" />,
                children: [{ path: 'reports', element: <ReportsPage /> }],
              },

              // -------------------------------------------- administration
              {
                element: <RequireCapability capability="manageUsers" />,
                children: [{ path: 'admin/users', element: <UsersPage /> }],
              },
              {
                element: <RequireCapability capability="manageSettings" />,
                children: [{ path: 'admin/settings', element: <SettingsPage /> }],
              },
              {
                element: <RequireCapability capability="viewAuditLog" />,
                children: [{ path: 'admin/audit', element: <AuditPage /> }],
              },
              {
                element: <RequireCapability capability="runJobs" />,
                children: [{ path: 'admin/operations', element: <OperationsPage /> }],
              },

              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
]);
