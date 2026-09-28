import { useState } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page';
import { ActiveBadge, RoleBadge } from '@/components/shared/status-badge';
import { ClearFilters, FilterBar, SearchFilter, SelectFilter } from '@/components/shared/filter-bar';
import {
  useCreateUserMutation,
  useDeactivateUserMutation,
  useListUsersQuery,
  useResetUserPasswordMutation,
  useUpdateUserMutation,
} from './admin-api';
import { useAuth } from '@/features/auth/use-auth';
import { ROLE_LABELS } from '@/app/permissions';
import { errorMessage } from '@/app/api-error';
import { formatInstant, formatRelative } from '@/lib/dates';
import { formatPhone, isValidBdPhone, PHONE_ERROR } from '@/lib/phone';
import { useDebounced } from '@/hooks/use-debounced';
import { ROLES, type Role, type User } from '@/types/api';
import { Copy, KeyRound, Loader2, UserMinus, UserPlus } from 'lucide-react';

export function UsersPage() {
  const { user: currentUser } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | undefined>();
  const debouncedSearch = useDebounced(search, 300);

  const query = useListUsersQuery({ page, limit: 25, search: debouncedSearch || undefined, role });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deactivating, setDeactivating] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);

  const [deactivateUser, deactivateState] = useDeactivateUserMutation();

  const columns: Array<Column<User>> = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      cell: (user) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {user.name}
            {user.id === currentUser?.id ? <span className="text-muted-foreground text-xs"> (you)</span> : null}
          </p>
          {user.email ? <p className="text-muted-foreground truncate text-xs">{user.email}</p> : null}
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', cell: (user) => <span className="tabular text-sm">{formatPhone(user.phone)}</span> },
    { key: 'role', header: 'Role', sortable: true, cell: (user) => <RoleBadge role={user.role} /> },
    {
      key: 'lastLoginAt',
      header: 'Last signed in',
      sortable: true,
      hideOnMobile: true,
      cell: (user) => (
        <span className="text-muted-foreground text-sm" title={formatInstant(user.lastLoginAt)}>
          {user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'never'}
        </span>
      ),
    },
    { key: 'isActive', header: 'Status', cell: (user) => <ActiveBadge isActive={user.isActive} /> },
    {
      key: 'actions',
      header: '',
      numeric: true,
      cell: (user) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(user)}>
            Edit
          </Button>
          <Button variant="ghost" size="icon" aria-label="Reset password" onClick={() => setResetting(user)}>
            <KeyRound className="size-4" />
          </Button>
          {/* The server refuses to deactivate yourself or the last active
              admin; hiding the obvious case keeps the UI honest. */}
          {user.isActive && user.id !== currentUser?.id ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Deactivate"
              onClick={() => setDeactivating(user)}
            >
              <UserMinus className="text-destructive size-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Deactivating someone ends their sessions immediately, on every device."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus /> Add staff
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
            <SelectFilter
              label="Role"
              value={role}
              onChange={(value) => {
                setRole(value);
                setPage(1);
              }}
              options={ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }))}
            />
            <ClearFilters
              show={Boolean(search || role)}
              onClear={() => {
                setSearch('');
                setRole(undefined);
                setPage(1);
              }}
            />
          </FilterBar>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(user) => user.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        meta={query.data?.meta}
        onPageChange={setPage}
        emptyTitle="No staff accounts"
      />

      <UserDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editing ? <UserDialog open onOpenChange={(open) => !open && setEditing(null)} user={editing} /> : null}
      {resetting ? (
        <ResetPasswordDialog user={resetting} onOpenChange={(open) => !open && setResetting(null)} />
      ) : null}

      <AlertDialog open={deactivating !== null} onOpenChange={(open) => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivating?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be signed out everywhere immediately and will not be able to sign in again. Their past sales
              and audit entries are kept and still show their name.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deactivateState.error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(deactivateState.error)}</AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivateState.isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deactivateState.isLoading}
              onClick={async (event) => {
                event.preventDefault();
                if (!deactivating) return;
                const result = await deactivateUser(deactivating.id).unwrap().catch(() => null);
                if (result) {
                  toast.success(`${deactivating.name} deactivated`);
                  setDeactivating(null);
                }
              }}
            >
              {deactivateState.isLoading ? <Loader2 className="animate-spin" /> : null}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

const baseSchema = {
  name: z.string().trim().min(2, 'Enter their name'),
  phone: z.string().refine(isValidBdPhone, PHONE_ERROR),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')),
  role: z.enum(ROLES),
};

const createSchema = z.object({
  ...baseSchema,
  password: z
    .string()
    .regex(PASSWORD_POLICY, 'At least 8 characters, with an uppercase letter, a lowercase letter and a digit'),
});

const editSchema = z.object({ ...baseSchema, isActive: z.boolean() });

function UserDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
}) {
  const isEdit = user !== undefined;
  const [createUser, createState] = useCreateUserMutation();
  const [updateUser, updateState] = useUpdateUserMutation();

  const state = isEdit ? updateState : createState;

  const form = useForm<z.infer<typeof createSchema> & { isActive?: boolean }>({
    resolver: zodResolver(isEdit ? (editSchema as never) : createSchema),
    defaultValues: isEdit
      ? { name: user.name, phone: user.phone, email: user.email ?? '', role: user.role, isActive: user.isActive }
      : { name: '', phone: '', email: '', role: 'RESTAURANT_CASHIER', password: '' },
  });

  const onSubmit = async (values: z.infer<typeof createSchema> & { isActive?: boolean }) => {
    const body = {
      name: values.name,
      phone: values.phone,
      ...(values.email ? { email: values.email } : {}),
      role: values.role,
    };

    const result = isEdit
      ? await updateUser({ id: user.id, body: { ...body, isActive: values.isActive } })
          .unwrap()
          .catch(() => null)
      : await createUser({ ...body, password: values.password }).unwrap().catch(() => null);

    if (result) {
      toast.success(isEdit ? `${result.name} updated` : `${result.name} added`);
      form.reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${user.name}` : 'Add a staff account'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Changing a role signs them out, so the new permissions take effect straight away.'
              : 'They will sign in with this phone number or email.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {state.error ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage(state.error)}</AlertDescription>
              </Alert>
            ) : null}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={state.isLoading} autoFocus />
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
                    <Input {...field} inputMode="tel" className="tabular" disabled={state.isLoading} />
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
                    <Input {...field} type="email" disabled={state.isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={state.isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {ROLE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEdit ? (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temporary password</FormLabel>
                    <FormControl>
                      <Input {...field} type="text" autoComplete="new-password" disabled={state.isLoading} />
                    </FormControl>
                    <FormDescription>
                      At least 8 characters, with an uppercase letter, a lowercase letter and a digit. Ask them to
                      change it after their first sign-in.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={state.isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={state.isLoading}>
                {state.isLoading ? <Loader2 className="animate-spin" /> : null}
                {isEdit ? 'Save changes' : 'Add staff'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onOpenChange }: { user: User; onOpenChange: (open: boolean) => void }) {
  const [resetPassword, { isLoading, error }] = useResetUserPasswordMutation();
  const [generated, setGenerated] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  const submit = async (useGenerated: boolean) => {
    const result = await resetPassword({
      id: user.id,
      ...(useGenerated ? {} : { newPassword: manual }),
    })
      .unwrap()
      .catch(() => null);

    if (!result) return;

    if (result.generatedPassword) {
      // Shown exactly once — the server never stores it in plain text, and it
      // is deliberately not written to the audit entry either.
      setGenerated(result.generatedPassword);
    } else {
      toast.success(`Password reset for ${user.name}`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset {user.name}'s password</DialogTitle>
          <DialogDescription>All of their sessions will be signed out.</DialogDescription>
        </DialogHeader>

        {generated ? (
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                Give them this password now — it is shown once and cannot be retrieved later.
              </AlertDescription>
            </Alert>
            <div className="flex items-center gap-2">
              <code className="bg-muted flex-1 rounded-md p-3 font-mono text-sm break-all">{generated}</code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy password"
                onClick={() => {
                  void navigator.clipboard.writeText(generated);
                  toast.success('Copied');
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage(error)}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="button" className="w-full" disabled={isLoading} onClick={() => void submit(true)}>
              {isLoading ? <Loader2 className="animate-spin" /> : <KeyRound />}
              Generate a strong password
            </Button>

            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <span className="bg-border h-px flex-1" /> or set one yourself <span className="bg-border h-px flex-1" />
            </div>

            <div className="flex gap-2">
              <Input
                value={manual}
                onChange={(event) => setManual(event.target.value)}
                placeholder="New password"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!PASSWORD_POLICY.test(manual) || isLoading}
                onClick={() => void submit(false)}
              >
                Set
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              At least 8 characters, with an uppercase letter, a lowercase letter and a digit.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
