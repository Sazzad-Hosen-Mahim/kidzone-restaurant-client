import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/page';
import { useAuth } from '@/features/auth/use-auth';
import { landingRouteFor } from '@/app/permissions';
import { FileQuestion } from 'lucide-react';

export function NotFoundPage() {
  const { role } = useAuth();

  return (
    <EmptyState
      icon={FileQuestion}
      title="Page not found"
      description="That address does not match anything in this app."
      action={
        <Button asChild variant="outline">
          <Link to={landingRouteFor(role)}>Go to your home screen</Link>
        </Button>
      }
      className="min-h-[60vh]"
    />
  );
}
