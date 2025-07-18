import { authClient, type User } from '@/auth/auth';
import { Avatar } from '@/shared/components/Avatar';
import { EmptyState, type EmptyStateProps } from '@/shared/components/EmptyState';
import { ROUTES } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import * as Sentry from '@sentry/react';
import mixpanel from 'mixpanel-browser';
import { useEffect, useState } from 'react';
import { useSubmit } from 'react-router';

type EmptyPageProps = Exclude<EmptyStateProps, 'isError'> & {
  showLoggedInUser?: boolean;
  error?: unknown;
  source?: string;
};

/**
 * For use in routes when errors occur or when there is no data to display.
 * Will displays context on the logged in user (if applicable/available)
 */
export function EmptyPage(props: EmptyPageProps) {
  const { error, title, description, source, Icon, actions, showLoggedInUser } = props;
  const [loggedInUser, setLoggedInUser] = useState<User | undefined>(undefined);
  const submit = useSubmit();

  // Remove the initial loading UI, as these empty pages are alternative rendering
  // paths to the primary routes
  useRemoveInitialLoadingUI();

  // Get the logged in user from the auth client for display
  useEffect(() => {
    if (!loggedInUser) {
      authClient.user().then((user) => setLoggedInUser(user));
    }
  }, [loggedInUser]);

  // If this is an error, log it
  useEffect(() => {
    if (error) {
      const errorString = JSON.stringify(
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error
      );
      // for core errors, we send the source but don't share it with the user
      const sourceTitle = source ? `Core Error in ${source}` : title;
      mixpanel.track('[Empty].error', {
        title: sourceTitle,
        description,
        error: errorString,
      });
      Sentry.captureException(new Error('error-page'), {
        extra: {
          title: sourceTitle,
          description,
          error,
        },
      });
    }
  }, [error, title, description, source]);

  // Content is centered on the page (should always be rendered in the root layout)
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <EmptyState title={title} description={description} actions={actions} Icon={Icon} isError={Boolean(error)} />
      {loggedInUser && showLoggedInUser && (
        <div className="mx-auto mt-12 max-w-96 border-t border-border pt-2">
          <div className="mx-auto flex items-center gap-2 rounded-md pt-2 text-left text-sm">
            <Avatar src={loggedInUser.picture} alt={`Avatar for ${loggedInUser.name}`} className="flex-shrink-0">
              {loggedInUser.name}
            </Avatar>
            <div className="flex flex-col justify-start truncate">{loggedInUser.email}</div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => submit('', { method: 'POST', action: ROUTES.LOGOUT })}
            >
              Logout
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
