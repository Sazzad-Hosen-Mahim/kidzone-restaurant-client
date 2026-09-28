import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/page';
import { Money } from '@/components/shared/money';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { cartCleared, itemAdded } from './cart-slice';
import { useGetMenuBoardQuery } from './restaurant-api';
import { OrderTicket } from './order-ticket';
import { cn } from '@/lib/utils';
import type { MenuBoardItem, Order } from '@/types/api';
import { OrderSuccess } from './order-success';
import { Search, UtensilsCrossed, X } from 'lucide-react';

/**
 * The restaurant till.
 *
 * Two panes: a tappable menu on the left, the running ticket on the right. On a
 * phone the ticket becomes a sheet pinned to the bottom, because a cashier on a
 * handheld still needs to see the total without losing the menu.
 *
 * Prices shown here are a snapshot for the cashier's benefit. The server reads
 * its own prices when the order is submitted, so a board left open through a
 * price change cannot undercharge.
 */
export function PosPage() {
  const { data: board, isLoading, error, refetch } = useGetMenuBoardQuery();
  const dispatch = useAppDispatch();
  const lines = useAppSelector((state) => state.cart.lines);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [completed, setCompleted] = useState<Order | null>(null);

  // Stable across renders, so the filter memo below is not defeated by a new
  // array identity every time.
  const categories = useMemo(() => board?.categories ?? [], [board]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return categories
      .filter((category) => activeCategory === 'all' || category.id === activeCategory)
      .map((category) => ({
        ...category,
        items: term
          ? category.items.filter(
              (item) =>
                item.name.toLowerCase().includes(term) || (item.sku ?? '').toLowerCase().includes(term),
            )
          : category.items,
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, activeCategory, search]);

  const itemCount = lines.reduce((total, line) => total + line.quantity, 0);

  if (completed) {
    return (
      <OrderSuccess
        order={completed}
        onNewOrder={() => {
          setCompleted(null);
          dispatch(cartCleared());
        }}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the menu…"
              className="pl-9"
              autoComplete="off"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 p-1"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {board ? (
            <Badge variant="outline" className="shrink-0">
              {board.itemCount} items on sale
            </Badge>
          ) : null}
        </div>

        {categories.length > 0 ? (
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <ScrollArea className="w-full">
              <TabsList className="w-max">
                <TabsTrigger value="all">All</TabsTrigger>
                {categories.map((category) => (
                  <TabsTrigger key={category.id} value={category.id}>
                    {category.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>
          </Tabs>
        ) : null}

        {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

        {isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : null}

        {board && visible.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-12 text-center text-sm">
              <UtensilsCrossed className="mx-auto mb-2 size-6" />
              {search ? `Nothing on the menu matches “${search}”.` : 'Nothing is available right now.'}
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-5">
          {visible.map((category) => (
            <section key={category.id} className="space-y-2">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {category.name}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {category.items.map((item) => (
                  <MenuTile
                    key={item.id}
                    item={item}
                    quantity={lines
                      .filter((line) => line.menuItemId === item.id)
                      .reduce((total, line) => total + line.quantity, 0)}
                    onAdd={() => dispatch(itemAdded({ item, categoryName: category.name }))}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Desktop: a sticky ticket. Mobile: a bar that opens the same ticket. */}
      <div className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
        <OrderTicket onCompleted={setCompleted} />
      </div>

      <MobileTicketBar itemCount={itemCount} onCompleted={setCompleted} />
    </div>
  );
}

function MenuTile({
  item,
  quantity,
  onAdd,
}: {
  item: MenuBoardItem;
  quantity: number;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        'relative flex flex-col justify-between rounded-lg border p-3 text-left transition-colors',
        'hover:border-primary/50 hover:bg-accent active:scale-[0.99]',
        quantity > 0 && 'border-primary/60 bg-primary/5',
      )}
    >
      {quantity > 0 ? (
        <span className="bg-primary text-primary-foreground tabular absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full text-xs font-semibold">
          {quantity}
        </span>
      ) : null}

      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-medium">{item.name}</p>
        {item.description ? (
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{item.description}</p>
        ) : null}
      </div>

      <Money value={item.price} className="mt-2 text-sm font-semibold" />
    </button>
  );
}

function MobileTicketBar({ itemCount, onCompleted }: { itemCount: number; onCompleted: (order: Order) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      {open ? (
        <div className="bg-background/80 fixed inset-0 z-40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="bg-background absolute inset-x-0 bottom-0 max-h-[88svh] overflow-auto rounded-t-xl border-t p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Current order</h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                <X />
              </Button>
            </div>
            <OrderTicket
              onCompleted={(order) => {
                setOpen(false);
                onCompleted(order);
              }}
            />
          </div>
        </div>
      ) : null}

      {itemCount > 0 && !open ? (
        <div className="bg-background fixed inset-x-0 bottom-0 z-30 border-t p-3">
          <Button type="button" size="lg" className="w-full" onClick={() => setOpen(true)}>
            View order
            <Separator orientation="vertical" className="mx-1 h-4" />
            <span className="tabular">{itemCount}</span> item{itemCount === 1 ? '' : 's'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
