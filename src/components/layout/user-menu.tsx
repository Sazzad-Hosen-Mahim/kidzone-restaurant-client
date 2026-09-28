import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/use-auth';
import { useLogoutMutation } from '@/features/auth/auth-api';
import { ROLE_LABELS } from '@/app/permissions';
import { formatPhone } from '@/lib/phone';
import { ChangePasswordDialog } from '@/features/auth/change-password-dialog';
import { KeyRound, LogOut } from 'lucide-react';

export function UserMenu() {
  const { user } = useAuth();
  const [logout, { isLoading }] = useLogoutMutation();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const navigate = useNavigate();

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogout = async () => {
    // The mutation clears local session state in its own `finally`, so even a
    // failed request still signs this browser out.
    await logout().unwrap().catch(() => undefined);
    toast.success('Signed out');
    navigate('/login', { replace: true });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-2">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/12 text-primary text-xs font-medium">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">{user.name}</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="space-y-0.5 font-normal">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-muted-foreground text-xs">{ROLE_LABELS[user.role]}</p>
            <p className="text-muted-foreground tabular text-xs">{formatPhone(user.phone)}</p>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
            <KeyRound /> Change password
          </DropdownMenuItem>

          <DropdownMenuItem disabled={isLoading} onSelect={() => void handleLogout()}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  );
}
