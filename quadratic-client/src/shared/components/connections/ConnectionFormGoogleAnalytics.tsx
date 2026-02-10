import { apiClient } from '@/shared/api/apiClient';
import { ConnectionFormSemantic } from '@/shared/components/connections/ConnectionFormSemantic';
import type { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { SyncedConnection } from '@/shared/components/connections/SyncedConnection';
import { SpinnerIcon } from '@/shared/components/Icons';
import { CONTACT_URL, DOCUMENTATION_CONNECTIONS_GOOGLE_ANALYTICS_URL } from '@/shared/constants/urls';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ConnectionNameSchema,
  ConnectionSemanticDescriptionSchema,
  ConnectionTypeSchema,
} from 'quadratic-shared/typesAndSchemasConnections';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ConnectionFormGoogleAnalyticsSchema = z.object({
  name: ConnectionNameSchema,
  semanticDescription: ConnectionSemanticDescriptionSchema,
  type: z.literal(ConnectionTypeSchema.enum.GOOGLE_ANALYTICS),
  property_id: z.string().min(1, { message: 'Required' }),
  // OAuth tokens
  access_token: z.string().min(1, { message: 'You must connect your Google account' }),
  refresh_token: z.string().min(1, { message: 'Required' }),
  token_expires_at: z.string().datetime(),
  start_date: z.string().date(),
});
type FormValues = z.infer<typeof ConnectionFormGoogleAnalyticsSchema>;

export const useConnectionForm: UseConnectionForm<FormValues> = (connection) => {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const defaultStartDate = threeMonthsAgo.toISOString().split('T')[0];

  const defaultValues: FormValues = {
    name: connection ? connection.name : '',
    semanticDescription: String(connection?.semanticDescription || ''),
    type: 'GOOGLE_ANALYTICS',
    property_id: connection?.typeDetails?.property_id || '',
    access_token: connection?.typeDetails?.access_token || '',
    refresh_token: connection?.typeDetails?.refresh_token || '',
    token_expires_at: connection?.typeDetails?.token_expires_at || new Date().toISOString(),
    start_date: connection?.typeDetails?.start_date || defaultStartDate,
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(ConnectionFormGoogleAnalyticsSchema),
    defaultValues,
  });

  return { form, connection };
};

export const ConnectionForm: ConnectionFormComponent<FormValues> = ({
  form,
  children,
  handleSubmitForm,
  handleCancelForm,
  connection,
  teamUuid,
}) => {
  const [hasTokens, setHasTokens] = useState<boolean>(!!connection?.typeDetails?.access_token);
  const [popupBlocked, setPopupBlocked] = useState(false);

  const openOAuthPopup = async () => {
    try {
      setPopupBlocked(false);
      form.clearErrors('root');

      const data = await apiClient.connections.google.getAuthUrl({
        teamUuid,
      });

      // Store nonce and PKCE code verifier in sessionStorage for verification on callback
      sessionStorage.setItem('google_oauth_nonce', data.nonce);
      sessionStorage.setItem('google_oauth_code_verifier', data.codeVerifier);

      // Open popup with the auth URL
      const width = 500;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        `/google-oauth-callback.html?authUrl=${encodeURIComponent(data.authUrl)}`,
        'google-oauth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        setPopupBlocked(true);
      }
    } catch (error) {
      console.error('Error fetching Google auth URL:', error);
      form.setError('root', { message: 'Failed to start Google authentication' });
    }
  };

  // Auto-open Google OAuth when the component mounts and we don't have tokens
  useEffect(() => {
    if (hasTokens) return;
    openOAuthPopup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTokens]);

  // Handle messages from Google OAuth popup via BroadcastChannel
  useEffect(() => {
    let isMounted = true;
    const channel = new BroadcastChannel('google_oauth');

    const handleMessage = async (event: MessageEvent) => {
      if (!isMounted) return;

      if (event.data.type === 'GOOGLE_SUCCESS') {
        try {
          // Verify CSRF nonce and team UUID from the OAuth state
          const storedNonce = sessionStorage.getItem('google_oauth_nonce');
          if (!storedNonce || event.data.nonce !== storedNonce) {
            form.setError('root', { message: 'OAuth state verification failed. Please try again.' });
            return;
          }
          if (event.data.teamUuid !== teamUuid) {
            form.setError('root', { message: 'OAuth state mismatch — possible security issue.' });
            return;
          }
          const codeVerifier = sessionStorage.getItem('google_oauth_code_verifier') || '';
          sessionStorage.removeItem('google_oauth_nonce');
          sessionStorage.removeItem('google_oauth_code_verifier');

          // Exchange the authorization code for tokens, passing the state and PKCE verifier
          const state = JSON.stringify({ teamUuid: event.data.teamUuid, nonce: event.data.nonce });
          const tokens = await apiClient.connections.google.exchangeToken({
            teamUuid,
            code: event.data.code,
            state,
            codeVerifier,
          });

          if (!isMounted) return;

          // Update form values with the tokens
          form.setValue('access_token', tokens.accessToken);
          form.setValue('refresh_token', tokens.refreshToken);
          form.setValue('token_expires_at', tokens.expiresAt);
          setHasTokens(true);
        } catch (error) {
          if (!isMounted) return;
          console.error('Error exchanging Google OAuth code:', error);
          form.setError('root', { message: 'Failed to complete Google authentication' });
        }
      } else if (event.data.type === 'GOOGLE_ERROR') {
        form.setError('root', { message: event.data.error || 'Google authentication failed' });
      }
    };

    channel.addEventListener('message', handleMessage);
    return () => {
      isMounted = false;
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [teamUuid, form]);

  // Show loading state while waiting for OAuth
  if (!hasTokens) {
    return (
      <div className="mx-auto mt-8 flex max-w-md flex-col items-center justify-center">
        {popupBlocked ? (
          <>
            <h4 className="mt-3 text-lg font-medium">Pop-up blocked</h4>
            <p className="text-center text-sm text-muted-foreground">
              Your browser blocked the Google sign-in window. Click below to try again, or allow pop-ups for this site.
            </p>
            <Button className="mt-4" onClick={openOAuthPopup}>
              Connect Google Account
            </Button>
          </>
        ) : (
          <>
            <SpinnerIcon className="text-muted-foreground" size="lg" />
            <h4 className="mt-3 text-lg font-medium">Connecting to Google…</h4>
            <p className="text-center text-sm text-muted-foreground">
              Follow the instructions in the pop-up window. If you're having trouble connecting,{' '}
              <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="underline hover:text-primary">
                contact us
              </a>
              .
            </p>
          </>
        )}
        {form.formState.errors.root && (
          <p className="mt-2 text-center text-sm text-destructive">{form.formState.errors.root.message}</p>
        )}
        <Button variant="outline" className="mt-4" onClick={handleCancelForm}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-2" autoComplete="off">
        <p className="pb-2 text-sm">
          Find your Property ID in Google Analytics under Admin → Property Settings.{' '}
          <a
            href={DOCUMENTATION_CONNECTIONS_GOOGLE_ANALYTICS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary"
          >
            Learn more
          </a>
          .
        </p>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Connection name</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="property_id"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Property ID</FormLabel>
                <FormControl>
                  <Input autoComplete="off" placeholder="e.g., 123456789" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem className="col-span-1">
                <FormLabel>Sync start date</FormLabel>
                <FormControl>
                  <Input type="date" autoComplete="off" className="block" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
          <p className="text-sm text-green-700 dark:text-green-300">✓ Google account connected successfully</p>
        </div>

        <ConnectionFormSemantic form={form} />

        {connection && (
          <div className="flex items-start gap-2 pt-2 text-sm">
            <Badge>Status</Badge>
            <SyncedConnection
              connectionUuid={connection.uuid}
              teamUuid={teamUuid}
              createdDate={connection.createdDate}
            />
          </div>
        )}
        {children}
      </form>
    </Form>
  );
};
