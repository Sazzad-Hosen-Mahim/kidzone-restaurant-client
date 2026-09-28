import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page';
import { Money } from '@/components/shared/money';
import { TakaInput } from '@/components/shared/taka-input';
import { ActiveBadge, AvailabilityBadge } from '@/components/shared/status-badge';
import { ClearFilters, FilterBar, SearchFilter, SelectFilter } from '@/components/shared/filter-bar';
import {
  useCreateCategoryMutation,
  useCreateMenuItemMutation,
  useDeleteMenuItemMutation,
  useListCategoriesQuery,
  useListMenuItemsQuery,
  useSetItemAvailabilityMutation,
  useUpdateMenuItemMutation,
} from './restaurant-api';
import { useAuth } from '@/features/auth/use-auth';
import { errorMessage } from '@/app/api-error';
import { useDebounced } from '@/hooks/use-debounced';
import type { MenuItem } from '@/types/api';
import { Info, Loader2, Plus } from 'lucide-react';

/**
 * Menu management.
 *
 * A cashier can reach this page but may only flip availability — "86 the
 * biryani" is a floor decision made mid-service. Everything else is admin-only,
 * and the controls reflect that rather than failing on submit.
 */
export function MenuPage() {
  const { can } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu"
        description={
          can.manageMenu
            ? 'Changing a price never alters an order already taken — each line keeps its own snapshot.'
            : 'You can mark items in and out of stock. Prices and the menu itself are managed by an administrator.'
        }
      />

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          {can.manageMenu ? <TabsTrigger value="categories">Categories</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="items" className="pt-4">
          <MenuItems />
        </TabsContent>

        {can.manageMenu ? (
          <TabsContent value="categories" className="pt-4">
            <Categories />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function MenuItems() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const debouncedSearch = useDebounced(search, 300);

  const { data: categories } = useListCategoriesQuery();
  // The whole menu is small enough to hold at once, and the POS screen already
  // has it cached — paging here would only add clicks.
  const query = useListMenuItemsQuery({ limit: 100, search: debouncedSearch || undefined, categoryId });

  const [setAvailability] = useSetItemAvailabilityMutation();
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteItem] = useDeleteMenuItemMutation();

  const columns: Array<Column<MenuItem>> = [
    {
      key: 'name',
      header: 'Item',
      cell: (item) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{item.name}</p>
          {item.description ? (
            <p className="text-muted-foreground line-clamp-1 text-xs">{item.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      hideOnMobile: true,
      cell: (item) => <span className="text-muted-foreground text-sm">{item.category?.name ?? '—'}</span>,
    },
    {
      key: 'sku',
      header: 'SKU',
      hideOnMobile: true,
      cell: (item) => <span className="text-muted-foreground font-mono text-xs">{item.sku ?? '—'}</span>,
    },
    { key: 'price', header: 'Price', numeric: true, cell: (item) => <Money value={item.price} className="font-medium" /> },
    {
      key: 'isAvailable',
      header: 'In stock',
      cell: (item) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={item.isAvailable}
            disabled={!item.isActive}
            aria-label={`${item.name} availability`}
            onCheckedChange={async (checked) => {
              const result = await setAvailability({ id: item.id, isAvailable: checked }).unwrap().catch(() => null);
              if (result) {
                toast.success(checked ? `${item.name} is back on` : `${item.name} marked out of stock`);
              }
            }}
          />
          <AvailabilityBadge isAvailable={item.isAvailable} />
        </div>
      ),
    },
    ...(can.manageMenu
      ? [
          { key: 'isActive', header: 'Status', cell: (item: MenuItem) => <ActiveBadge isActive={item.isActive} /> },
          {
            key: 'actions',
            header: '',
            numeric: true,
            cell: (item: MenuItem) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(item)}>
                  Edit
                </Button>
                {item.isActive ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={async () => {
                      const result = await deleteItem(item.id).unwrap().catch(() => null);
                      if (result) toast.success(`${item.name} removed from the menu`);
                    }}
                  >
                    Retire
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <FilterBar>
            <SearchFilter value={search} onChange={setSearch} placeholder="Item name or SKU…" />
            <SelectFilter
              label="Category"
              value={categoryId}
              onChange={setCategoryId}
              options={(categories ?? []).map((category) => ({ value: category.id, label: category.name }))}
              allLabel="All categories"
            />
            <ClearFilters
              show={Boolean(search || categoryId)}
              onClear={() => {
                setSearch('');
                setCategoryId(undefined);
              }}
            />
            {can.manageMenu ? (
              <Button className="ml-auto" onClick={() => setCreating(true)}>
                <Plus /> New item
              </Button>
            ) : null}
          </FilterBar>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(item) => item.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle="No menu items"
      />

      {creating ? <ItemDialog onOpenChange={(open) => !open && setCreating(false)} /> : null}
      {editing ? <ItemDialog item={editing} onOpenChange={(open) => !open && setEditing(null)} /> : null}
    </div>
  );
}

function ItemDialog({ item, onOpenChange }: { item?: MenuItem; onOpenChange: (open: boolean) => void }) {
  const isEdit = item !== undefined;
  const { data: categories } = useListCategoriesQuery();
  const [createItem, createState] = useCreateMenuItemMutation();
  const [updateItem, updateState] = useUpdateMenuItemMutation();
  const state = isEdit ? updateState : createState;

  const [form, setForm] = useState({
    categoryId: item?.categoryId ?? '',
    name: item?.name ?? '',
    description: item?.description ?? '',
    price: item?.price ?? 0,
    sku: item?.sku ?? '',
    sortOrder: item?.sortOrder ?? 0,
  });

  const priceChanged = isEdit && form.price !== item.price;

  const submit = async () => {
    const body = {
      categoryId: form.categoryId,
      name: form.name.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      price: form.price,
      ...(form.sku.trim() ? { sku: form.sku.trim() } : {}),
      sortOrder: form.sortOrder,
    };

    const result = isEdit
      ? await updateItem({ id: item.id, body }).unwrap().catch(() => null)
      : await createItem(body).unwrap().catch(() => null);

    if (result) {
      toast.success(isEdit ? `${result.name} updated` : `${result.name} added`);
      onOpenChange(false);
    }
  };

  const valid = form.name.trim().length >= 2 && form.categoryId !== '' && form.price >= 0;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${item.name}` : 'New menu item'}</DialogTitle>
          <DialogDescription>Prices are in taka and stored to the poisha.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(state.error)}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              maxLength={120}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-category">Category</Label>
            <Select value={form.categoryId} onValueChange={(value) => setForm({ ...form, categoryId: value })}>
              <SelectTrigger id="item-category">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {(categories ?? [])
                  .filter((category) => category.isActive)
                  .map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-description">Description (optional)</Label>
            <Input
              id="item-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              maxLength={300}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-price">Price</Label>
              <TakaInput id="item-price" value={form.price} onChange={(price) => setForm({ ...form, price })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-sku">SKU</Label>
              <Input
                id="item-sku"
                value={form.sku}
                onChange={(event) => setForm({ ...form, sku: event.target.value })}
                maxLength={40}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-sort">Order</Label>
              <Input
                id="item-sort"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
                className="tabular"
              />
            </div>
          </div>

          {priceChanged ? (
            <Alert>
              <Info />
              <AlertDescription>
                The change is recorded in the item's price history. Orders already taken keep their own price.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={state.isLoading}>
            Cancel
          </Button>
          <Button type="button" disabled={!valid || state.isLoading} onClick={() => void submit()}>
            {state.isLoading ? <Loader2 className="animate-spin" /> : null}
            {isEdit ? 'Save changes' : 'Add item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Categories() {
  const query = useListCategoriesQuery();
  const [createCategory, { isLoading, error }] = useCreateCategoryMutation();
  const [name, setName] = useState('');

  const add = async () => {
    const result = await createCategory({ name: name.trim() }).unwrap().catch(() => null);
    if (result) {
      toast.success(`${result.name} added`);
      setName('');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New category name"
              maxLength={80}
            />
            <Button type="button" disabled={name.trim().length < 2 || isLoading} onClick={() => void add()}>
              {isLoading ? <Loader2 className="animate-spin" /> : <Plus />}
              Add
            </Button>
          </div>
          {error ? <p className="text-destructive text-sm">{errorMessage(error)}</p> : null}
        </CardContent>
      </Card>

      <DataTable
        columns={[
          { key: 'name', header: 'Category', cell: (category) => <span className="font-medium">{category.name}</span> },
          {
            key: 'sortOrder',
            header: 'Order',
            numeric: true,
            cell: (category) => <span className="tabular text-sm">{category.sortOrder}</span>,
          },
          { key: 'isActive', header: 'Status', cell: (category) => <ActiveBadge isActive={category.isActive} /> },
        ]}
        rows={query.data}
        rowKey={(category) => category.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle="No categories"
      />

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Info className="size-3.5" />
        A category cannot be retired while it still holds active items.
      </p>
    </div>
  );
}
