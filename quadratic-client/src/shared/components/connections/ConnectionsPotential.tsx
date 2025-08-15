import { useRootRouteLoaderData } from '@/routes/_root';
import { apiClient } from '@/shared/api/apiClient';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { SpinnerIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { captureException } from '@sentry/react';
import { useCallback, useState } from 'react';

export function ConnectionsPotential({
  handleNavigateToListView,
  connectionType,
}: {
  handleNavigateToListView: () => void;
  connectionType: string;
}) {
  const { loggedInUser } = useRootRouteLoaderData();

  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      try {
        setIsSubmitting(true);
        const payload = {
          feedback,
          userEmail: loggedInUser?.email,
          context: `Connection request: ${connectionType}`,
        };
        await apiClient.postFeedback(payload);
        handleNavigateToListView();
        addGlobalSnackbar('Feedback submitted');
      } catch (e) {
        setIsSubmitting(false);
        captureException(e);
        addGlobalSnackbar('Failed to submit feedback. Please try again.', { severity: 'error' });
      }
    },
    [addGlobalSnackbar, connectionType, feedback, handleNavigateToListView, loggedInUser?.email]
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        <strong>This connection isn’t supported yet.</strong> We plan to add it, and your input will help us prioritize.
        Share your use case, and we’ll contact you when it’s available.
      </p>

      <form className="mt-2 flex flex-col gap-4" onSubmit={handleSubmit}>
        <Textarea
          autoFocus
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          autoHeight
          placeholder="I’m interested in this connection because…"
          className="min-h-24 pt-2"
        />
        <div className="flex items-center justify-end gap-2">
          {isSubmitting && <SpinnerIcon className="mr-2 text-primary" />}
          <Button variant="outline" onClick={handleNavigateToListView} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !feedback}>
            Submit feedback
          </Button>
        </div>
      </form>
    </div>
  );
}
