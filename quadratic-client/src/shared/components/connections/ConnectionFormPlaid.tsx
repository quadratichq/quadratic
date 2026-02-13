import { deriveSyncStateFromConnectionList } from '@/app/atoms/useSyncedConnection';
import { apiClient } from '@/shared/api/apiClient';
import { ConnectionFormSemantic } from '@/shared/components/connections/ConnectionFormSemantic';
import type { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { SyncedConnectionStatus } from '@/shared/components/connections/SyncedConnection';
import { SpinnerIcon } from '@/shared/components/Icons';
import { CONTACT_URL } from '@/shared/constants/urls';
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

const ConnectionFormPlaidSchema = z.object({
  name: ConnectionNameSchema,
  semanticDescription: ConnectionSemanticDescriptionSchema,
  type: z.literal(ConnectionTypeSchema.enum.PLAID),
  access_token: z.string().min(1, { message: 'You must connect a bank account' }),
  start_date: z.string().date(),
  institution_name: z.string().optional(),
});
type FormValues = z.infer<typeof ConnectionFormPlaidSchema>;

export const useConnectionForm: UseConnectionForm<FormValues> = (connection) => {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const defaultStartDate = threeMonthsAgo.toISOString().split('T')[0];

  const defaultValues: FormValues = {
    name: connection ? connection.name : '',
    semanticDescription: String(connection?.semanticDescription || ''),
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
  handleCancelForm,
  connection,
  teamUuid,
}) => {
  const [accessToken, setAccessToken] = useState<string | null>(connection?.typeDetails?.access_token || null);
  const [, setLinkedInstitution] = useState<string | null>(connection?.typeDetails?.institution_name || null);

  // Auto-open Plaid when the component mounts and we don't have an access token
  useEffect(() => {
    const fetchLinkTokenAndOpen = async () => {
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
      }
    };
    if (!accessToken) {
      console.log('No access token, opening Plaid Link');
      fetchLinkTokenAndOpen();
    }
  }, [accessToken, teamUuid]);

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

          // Set the access token in the form and state
          setAccessToken(data.accessToken);
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
        }

        handleCancelForm();
      }
    };

    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [teamUuid, form, handleCancelForm]);

  const hasAccessToken = !!form.watch('access_token');

  if (!hasAccessToken) {
    return (
      <div className="mx-auto mt-8 flex max-w-md flex-col items-center justify-center">
        <SpinnerIcon className="text-muted-foreground" size="lg" />
        <h4 className="mt-3 text-lg font-medium">Connecting to Plaid…</h4>
        <p className="text-center text-sm text-muted-foreground">
          Follow the instructions in the pop-up window. If you’re having trouble connecting,{' '}
          <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="underline hover:text-primary">
            contact us
          </a>
          .
        </p>
        <Button variant="outline" className="mt-4" onClick={handleCancelForm}>
          Cancel
        </Button>
      </div>
    );
  }

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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="institution_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Institution</FormLabel>
                <FormControl>
                  <Input type="text" disabled {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sync start date</FormLabel>
                <FormControl>
                  <Input type="date" autoComplete="off" className="block" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <ConnectionFormSemantic form={form} />

        {connection && (
          <div className="flex items-start gap-2 pt-2 text-sm">
            <SyncedConnectionStatus
              syncState={deriveSyncStateFromConnectionList(connection)}
              updatedDate={connection.syncedConnectionUpdatedDate}
              latestLogError={connection.syncedConnectionLatestLogError}
              createdDate={connection.createdDate}
            />
          </div>
        )}

        {/* Hidden fields */}
        <FormField control={form.control} name="access_token" render={() => <input type="hidden" />} />
        <FormField control={form.control} name="institution_name" render={() => <input type="hidden" />} />

        {children}
      </form>
    </Form>
  );
};
