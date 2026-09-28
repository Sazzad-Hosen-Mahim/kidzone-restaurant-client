import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page';
import { ActiveBadge } from '@/components/shared/status-badge';
import { ClearFilters, FilterBar, SearchFilter } from '@/components/shared/filter-bar';
import { useCreateCustomerMutation, useListCustomersQuery } from './customers-api';
import { useAuth } from '@/features/auth/use-auth';
import { errorCode, errorMessage } from '@/app/api-error';
import { formatBusinessDate } from '@/lib/dates';
import { formatPhone, isValidBdPhone, PHONE_ERROR } from '@/lib/phone';
import { useDebounced } from '@/hooks/use-debounced';
import type { Customer } from '@/types/api';
import { Loader2, UserPlus, Users } from 'lucide-react';

export function CustomersPage() {
  const { can } = useAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounced(search, 300);

  const query = useListCustomersQuery({
    page,
    limit: 25,
    search: debouncedSearch || undefined,
    isActive: true,
  });

  const columns: Array<Column<Customer>> = [
    {
      key: 'name',
      header: 'Guardian',
      sortable: true,
      cell: (customer) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{customer.name}</p>
          {customer.email ? <p className="text-muted-foreground truncate text-xs">{customer.email}</p> : null}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (customer) => <span className="tabular text-sm">{formatPhone(customer.phone)}</span>,
    },
    {
      key: 'childCount',
      header: 'Children',
      numeric: true,
      cell: (customer) => <span className="tabular text-sm">{customer.childCount ?? 0}</span>,
    },
    {
      key: 'address',
      header: 'Address',
      hideOnMobile: true,
      cell: (customer) => (
        <span className="text-muted-foreground line-clamp-1 text-sm">{customer.address ?? '—'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Since',
      hideOnMobile: true,
      sortable: true,
      cell: (customer) => <span className="tabular text-sm">{formatBusinessDate(customer.createdAt)}</span>,
    },
    { key: 'isActive', header: 'Status', cell: (customer) => <ActiveBadge isActive={customer.isActive} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={
          can.viewChildData
            ? 'Guardians and their children, shared by both sections.'
            : 'Guardians shared by both sections. Child records are Kid Zone data and are not shown here.'
        }
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus /> Add customer
          </Button>
        }
      />

      <Card>
        <CardContent>
          <FilterBar>
            <SearchFilter
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Name, phone or email…"
            />
            <ClearFilters
              show={Boolean(search)}
              onClear={() => {
                setSearch('');
                setPage(1);
              }}
            />
          </FilterBar>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(customer) => customer.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRowClick={(customer) => navigate(`/customers/${customer.id}`)}
        meta={query.data?.meta}
        onPageChange={setPage}
        emptyTitle="No customers"
        emptyDescription={
          search ? `Nothing matches “${search}”.` : 'Customers are created automatically when you ring up a sale.'
        }
      />

      <CreateCustomerDialog open={createOpen} onOpenChange={setCreateOpen} />

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Users className="size-3.5" />
        The phone number is what links a guardian across the Kid Zone and the restaurant, so it is unique.
      </p>
    </div>
  );
}

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the guardian’s name'),
  phone: z.string().refine(isValidBdPhone, PHONE_ERROR),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')),
  address: z.string().trim().max(300).or(z.literal('')),
});

type Values = z.infer<typeof schema>;

function CreateCustomerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [createCustomer, { isLoading, error, reset }] = useCreateCustomerMutation();
  const navigate = useNavigate();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', email: '', address: '' },
  });

  const onSubmit = async (values: Values) => {
    const customer = await createCustomer({
      name: values.name,
      phone: values.phone,
      ...(values.email ? { email: values.email } : {}),
      ...(values.address ? { address: values.address } : {}),
    })
      .unwrap()
      .catch(() => null);

    if (customer) {
      toast.success(`${customer.name} added`);
      form.reset();
      onOpenChange(false);
      navigate(`/customers/${customer.id}`);
    }
  };

  const duplicate = errorCode(error) === 'CUSTOMER_PHONE_EXISTS';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          form.reset();
          reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a customer</DialogTitle>
          <DialogDescription>
            Only needed if you want the record before a sale — selling creates one automatically.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {duplicate ? 'A customer with that phone number already exists.' : errorMessage(error)}
                </AlertDescription>
              </Alert>
            ) : null}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Shahana Akter" disabled={isLoading} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="01712345678" inputMode="tel" className="tabular" disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="House 12, Road 5, Dhanmondi" disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : null}
                Add customer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
