import type { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { SyncedConnection } from '@/shared/components/connections/SyncedConnection';
import { Button } from '@/shared/shadcn/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { ConnectionNameSchema, ConnectionTypeSchema } from 'quadratic-shared/typesAndSchemasConnections';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { usePlaidLink } from 'react-plaid-link';
import { z } from 'zod';

const ConnectionFormPlaidSchema = z.object({
  name: ConnectionNameSchema,
  type: z.literal(ConnectionTypeSchema.enum.PLAID),
  access_token: z.string().min(1, { message: 'You must connect a bank account' }),
  start_date: z.string().date(),
  environment: z.enum(['sandbox', 'development', 'production']).default('sandbox'),
});
type FormValues = z.infer<typeof ConnectionFormPlaidSchema>;

export const useConnectionForm: UseConnectionForm<FormValues> = (connection) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const defaultStartDate = thirtyDaysAgo.toISOString().split('T')[0];

  const defaultValues: FormValues = {
    name: connection ? connection.name : '',
    type: 'PLAID',
    access_token: connection?.typeDetails?.access_token || '',
    start_date: connection?.typeDetails?.start_date || defaultStartDate,
    environment: connection?.typeDetails?.environment || 'sandbox',
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(ConnectionFormPlaidSchema),
    defaultValues,
  });

  return { form, connection };
};

export const ConnectionForm: ConnectionFormComponent<FormValues> = ({
  form,
  children,
  handleSubmitForm,
  connection,
  teamUuid,
}) => {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [linkedInstitution, setLinkedInstitution] = useState<string | null>(
    connection?.typeDetails?.institution_name || null
  );

  // Fetch link token from backend
  const fetchLinkToken = useCallback(async () => {
    setIsLoadingToken(true);
    try {
      // TODO: Replace with actual API endpoint
      const response = await fetch(`/api/v0/teams/${teamUuid}/plaid/link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: form.getValues('environment'),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create link token');
      }

      const data = await response.json();
      setLinkToken(data.linkToken);
    } catch (error) {
      console.error('Error fetching link token:', error);
      // TODO: Show error to user
    } finally {
      setIsLoadingToken(false);
    }
  }, [teamUuid, form]);

  // Handle successful Plaid Link
  const onSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      try {
        // Exchange public token for access token
        // TODO: Replace with actual API endpoint
        const response = await fetch(`/api/v0/teams/${teamUuid}/plaid/exchange-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken,
            environment: form.getValues('environment'),
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to exchange token');
        }

        const data = await response.json();

        // Set the access token in the form
        form.setValue('access_token', data.accessToken);

        // Store institution name for display
        setLinkedInstitution(metadata.institution?.name || 'Bank Account');

        // Auto-populate connection name if empty
        if (!form.getValues('name')) {
          form.setValue('name', `${metadata.institution?.name || 'Bank'} Connection`);
        }
      } catch (error) {
        console.error('Error exchanging token:', error);
        // TODO: Show error to user
      }
    },
    [teamUuid, form]
  );

  // Initialize Plaid Link
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: (err, metadata) => {
      if (err) {
        console.error('Plaid Link error:', err);
        // TODO: Show error to user
      }
      // Reset link token so user can try again
      setLinkToken(null);
    },
  });

  // Auto-fetch link token if editing existing connection
  useEffect(() => {
    if (connection && !linkToken) {
      fetchLinkToken();
    }
  }, [connection, linkToken, fetchLinkToken]);

  const hasAccessToken = !!form.watch('access_token');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-2" autoComplete="off">
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
            name="environment"
            render={({ field }) => (
              <FormItem className="col-span-3">
                <FormLabel>Environment</FormLabel>
                <FormControl>
                  <select {...field} className="w-full rounded-md border p-2" disabled={hasAccessToken}>
                    <option value="sandbox">Sandbox (Testing)</option>
                    <option value="development">Development</option>
                    <option value="production">Production</option>
                  </select>
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground">
                  Use Sandbox for testing with credentials: user_good / pass_good
                </p>
              </FormItem>
            )}
          />

          <div className="col-span-3">
            <FormLabel>Bank Account Connection</FormLabel>
            {hasAccessToken && linkedInstitution ? (
              <div className="mt-2 rounded-md border border-green-200 bg-green-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-green-900">✓ Connected to {linkedInstitution}</p>
                    <p className="text-sm text-green-700">Access token obtained successfully</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue('access_token', '');
                      setLinkedInstitution(null);
                      setLinkToken(null);
                    }}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {!linkToken && (
                  <Button
                    type="button"
                    onClick={fetchLinkToken}
                    disabled={isLoadingToken}
                    className="w-full"
                    variant="outline"
                  >
                    {isLoadingToken ? 'Initializing...' : 'Connect Bank Account'}
                  </Button>
                )}
                {linkToken && (
                  <Button type="button" onClick={() => open()} disabled={!ready} className="w-full">
                    {ready ? 'Select Your Bank' : 'Loading Plaid Link...'}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Click to securely connect your bank account via Plaid. You'll be able to search for and select your
                  financial institution.
                </p>
              </div>
            )}
            <FormMessage />
          </div>

          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem className="col-span-3">
                <FormLabel>Sync Start Date</FormLabel>
                <FormControl>
                  <Input type="date" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground">Transactions from this date forward will be synced</p>
              </FormItem>
            )}
          />

          {/* Hidden field for access_token */}
          <FormField control={form.control} name="access_token" render={() => <input type="hidden" />} />

          <div className="col-span-3">
            <label htmlFor="syncing-progress" className="mb-0 text-sm font-medium">
              Data Sync Status
            </label>
            {connection && (
              <p className="mb-4 mt-2 text-xs text-red-500">
                <SyncedConnection
                  connectionUuid={connection.uuid}
                  teamUuid={teamUuid}
                  createdDate={connection.createdDate}
                />
              </p>
            )}
          </div>
        </div>
        {children}
      </form>
    </Form>
  );
};
