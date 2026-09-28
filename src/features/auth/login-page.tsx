import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useLoginMutation } from './auth-api';
import { useAuth } from './use-auth';
import { landingRouteFor } from '@/app/permissions';
import { errorCode, errorMessage } from '@/app/api-error';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { AlertCircle, Eye, EyeOff, Loader2, PartyPopper } from 'lucide-react';

const schema = z.object({
  identifier: z.string().trim().min(1, 'Enter your phone number or email'),
  password: z.string().min(8, 'Your password is at least 8 characters'),
});

type LoginValues = z.infer<typeof schema>;

export function LoginPage() {
  const [login, { isLoading, error }] = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', password: '' },
  });

  // Where the guard bounced us from, so signing in resumes the intended page.
  const from = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    if (isAuthenticated) navigate(from ?? landingRouteFor(role), { replace: true });
  }, [isAuthenticated, role, from, navigate]);

  if (isAuthenticated) return <Navigate to={from ?? landingRouteFor(role)} replace />;

  const onSubmit = async (values: LoginValues) => {
    try {
      await login(values).unwrap();
    } catch {
      // The error is rendered from the mutation's own state below; swallowing
      // it here just stops it reaching the console as unhandled.
    }
  };

  const throttled = errorCode(error) === 'TOO_MANY_LOGIN_ATTEMPTS';

  return (
    <div className="bg-muted/40 flex min-h-svh flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
              <PartyPopper className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Kid Zone &amp; Restaurant</h1>
              <p className="text-muted-foreground text-sm">Sign in to the point of sale</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Use the phone number or email your administrator gave you.</CardDescription>
            </CardHeader>

            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                  {error ? (
                    <Alert variant="destructive">
                      <AlertCircle />
                      <AlertDescription>
                        {errorMessage(error, 'Invalid credentials')}
                        {throttled ? (
                          <span className="mt-1 block text-xs">
                            Logins are limited to 5 attempts a minute for each account and each device.
                          </span>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <FormField
                    control={form.control}
                    name="identifier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone or email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete="username"
                            autoFocus
                            placeholder="01711000001"
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="current-password"
                              disabled={isLoading}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => setShowPassword((v) => !v)}
                              tabIndex={-1}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin" /> : null}
                    Sign in
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <p className="text-muted-foreground text-center text-xs">
            Having trouble? Ask an administrator to reset your password.
          </p>
        </div>
      </div>
    </div>
  );
}
