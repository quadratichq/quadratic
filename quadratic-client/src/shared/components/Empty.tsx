import { authClient, type User } from '@/auth/auth';
import { Avatar } from '@/shared/components/Avatar';
import { TYPE } from '@/shared/constants/appConstants';
import { ROUTES } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import type { IconProps } from '@radix-ui/react-icons/dist/types';
import * as Sentry from '@sentry/react';
import mixpanel from 'mixpanel-browser';
import { useEffect, useState } from 'react';
import { useSubmit } from 'react-router';

type EmptyStateProps = {
  description: React.ReactNode | string;
  Icon: React.ForwardRefExoticComponent<IconProps>;
  title: string;
  actions?: React.ReactNode;
  className?: string;
  isError?: boolean;
};

type EmptyPageProps = Exclude<EmptyStateProps, 'isError'> & {
  showLoggedInUser?: boolean;
  error?: unknown;
  source?: string;
};

/**
 * Component for use in various places throughout the app when we want to display
 * what is essentially a 'no data' state, e.g. when a user has no files, or no connections.
 * It is also used when there are errors, or a 404, which is an "empty state".
 */
export function EmptyState({ title, description, actions, Icon, isError, className }: EmptyStateProps) {
  return (
    <div className={cn(`max-w mx-auto max-w-md px-2 text-center`, className)}>
      <div
        className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center border border-border text-muted-foreground`}
      >
        <Icon className={cn(`h-[30px] w-[30px]`, isError && 'text-destructive')} />
      </div>
      <h4 className={cn(TYPE.h4, `mb-1`, isError && 'text-destructive')}>{title}</h4>
      <div className={`text-sm text-muted-foreground`}>{description}</div>
      {actions && <div className={`mt-8`}>{actions}</div>}
    </div>
  );
}

/**
 * For use in routes when errors occur or when there is no data to display.
 * Will displays context on the logged in user (if applicable/available)
 */
export function EmptyPage(props: EmptyPageProps) {
  const { error, title, description, source, Icon, actions } = props;
  const [loggedInUser, setLoggedInUser] = useState<User | undefined>(undefined);
  const submit = useSubmit();

  // Remove the intial loading UI, as these empty pages are alternative rendering
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
      // for core errors, we send the source but don't share it with the user
      const sourceTitle = source ? `Core Error in ${source}` : title;
      mixpanel.track('[Empty].error', {
        title: sourceTitle,
        description,
        error: JSON.stringify(error),
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
      {loggedInUser && (
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
