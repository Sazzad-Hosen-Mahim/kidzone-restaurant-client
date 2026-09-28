import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/use-auth';
import { visibleGroups } from './navigation';
import { UserMenu } from './user-menu';
import { ThemeToggle } from './theme-toggle';
import { BusinessDateBadge } from './business-date-badge';
import { Menu, PartyPopper } from 'lucide-react';

/**
 * The application frame: a fixed sidebar on desktop, a sheet on mobile.
 *
 * The sidebar is built from the same capability matrix the router guards use,
 * so a role never sees a link it cannot follow.
 */
export function AppShell() {
  const { can } = useAuth();
  const groups = visibleGroups(can);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-background flex min-h-svh">
      <aside className="bg-sidebar no-print hidden w-64 shrink-0 border-r lg:flex lg:flex-col">
        <BrandMark />
        <ScrollArea className="flex-1">
          <SidebarNav groups={groups} />
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/85 no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <BrandMark />
              <ScrollArea className="h-[calc(100svh-4rem)]">
                {/* Closing from the link itself, rather than from an effect on
                    the location, keeps it to one render. */}
                <SidebarNav groups={groups} onNavigate={() => setMobileOpen(false)} />
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <BusinessDateBadge />

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex h-14 items-center gap-2.5 border-b px-4">
      <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
        <PartyPopper className="size-4" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold">Kid Zone</p>
        <p className="text-muted-foreground truncate text-[11px]">& Restaurant</p>
      </div>
    </div>
  );
}

function SidebarNav({
  groups,
  onNavigate,
}: {
  groups: ReturnType<typeof visibleGroups>;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-4 p-3">
      {groups.map((group, index) => (
        <div key={group.label} className="space-y-1">
          {index > 0 ? <Separator className="mb-3" /> : null}
          <p className="text-muted-foreground px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
            {group.label}
          </p>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-primary/12 text-sidebar-primary font-medium'
                    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )
              }
            >
              <item.icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
