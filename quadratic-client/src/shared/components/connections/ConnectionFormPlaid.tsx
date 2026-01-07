import { apiClient } from '@/shared/api/apiClient';
import type { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { SyncedConnection } from '@/shared/components/connections/SyncedConnection';
import { Button } from '@/shared/shadcn/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { ConnectionNameSchema, ConnectionTypeSchema } from 'quadratic-shared/typesAndSchemasConnections';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ConnectionFormPlaidSchema = z.object({
  name: ConnectionNameSchema,
  type: z.literal(ConnectionTypeSchema.enum.PLAID),
  access_token: z.string().min(1, { message: 'You must connect a bank account' }),
  start_date: z.string().date(),
  institution_name: z.string().optional(),
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
    institution_name: connection?.typeDetails?.institution_name || '',
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
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [linkedInstitution, setLinkedInstitution] = useState<string | null>(
    connection?.typeDetails?.institution_name || null
  );

  // Fetch link token from backend and automatically open Plaid Link
  const fetchLinkTokenAndOpen = useCallback(async () => {
    setIsLoadingToken(true);
    try {
      const data = await apiClient.connections.plaid.createLinkToken({
        teamUuid,
      });

      // Automatically open popup with the link token
      const width = 500;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      window.open(
        `/plaid-link.html?linkToken=${encodeURIComponent(data.linkToken)}`,
        'plaid-link',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );
    } catch (error) {
      console.error('Error fetching link token:', error);
      // TODO: Show error to user
    } finally {
      setIsLoadingToken(false);
    }
  }, [teamUuid]);

  // Handle messages from Plaid popup via BroadcastChannel
  useEffect(() => {
    const channel = new BroadcastChannel('plaid_link');

    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === 'PLAID_SUCCESS') {
        const { publicToken, metadata } = event.data;
        try {
          const data = await apiClient.connections.plaid.exchangeToken({
            teamUuid,
            publicToken,
          });

          // Set the access token in the form
          form.setValue('access_token', data.accessToken);

          // Store institution name in form and state
          const institutionName = metadata.institution?.name || 'Bank Account';
          form.setValue('institution_name', institutionName);
          setLinkedInstitution(institutionName);

          // Auto-populate connection name if empty
          if (!form.getValues('name')) {
            form.setValue('name', `${metadata.institution?.name || 'Bank'} Connection`);
          }
        } catch (error) {
          console.error('Error exchanging token:', error);
          // TODO: Show error to user
        }
      } else if (event.data.type === 'PLAID_EXIT') {
        if (event.data.error) {
          console.error('Plaid Link error:', event.data.error);
          // TODO: Show error to user
        }
      }
    };

    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [teamUuid, form]);

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
                      form.setValue('institution_name', '');
                      setLinkedInstitution(null);
                    }}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <Button
                  type="button"
                  onClick={fetchLinkTokenAndOpen}
                  disabled={isLoadingToken}
                  className="w-full"
                  variant="outline"
                >
                  {isLoadingToken ? 'Opening Plaid Link...' : 'Connect Bank Account'}
                </Button>
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

          {/* Hidden fields */}
          <FormField control={form.control} name="access_token" render={() => <input type="hidden" />} />
          <FormField control={form.control} name="institution_name" render={() => <input type="hidden" />} />

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
