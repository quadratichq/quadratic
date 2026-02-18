import { deriveSyncStateFromConnectionList } from '@/app/atoms/useSyncedConnection';
import { ConnectionFormSemantic } from '@/shared/components/connections/ConnectionFormSemantic';
import type { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { SyncedConnectionStatus } from '@/shared/components/connections/SyncedConnection';
import { DOCUMENTATION_CONNECTIONS_GOOGLE_ANALYTICS_URL } from '@/shared/constants/urls';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ConnectionNameSchema,
  ConnectionSemanticDescriptionSchema,
  ConnectionTypeSchema,
} from 'quadratic-shared/typesAndSchemasConnections';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ConnectionFormGoogleAnalyticsSchema = z.object({
  name: ConnectionNameSchema,
  semanticDescription: ConnectionSemanticDescriptionSchema,
  type: z.literal(ConnectionTypeSchema.enum.GOOGLE_ANALYTICS),
  property_id: z.string().min(1, { message: 'Required' }),
  service_account_configuration: z.string().min(1, { message: 'Required' }),
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
    service_account_configuration: connection?.typeDetails?.service_account_configuration || '',
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
  connection,
  teamUuid,
}) => {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-2" autoComplete="off">
        <p className="pb-2 text-sm">Find your Property ID in Google Analytics under Admin → Property Settings. .</p>
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
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormDescription>
                  In your Google Analytics property settings. <LearnMore />
                </FormDescription>
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
        <FormField
          control={form.control}
          name="service_account_configuration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Service account configuration (JSON)</FormLabel>
              <FormControl>
                <Textarea autoComplete="off" {...field} className="h-48" />
              </FormControl>
              <FormDescription className="!mt-0">
                In Google Analytics, you must create a service account, assign roles for access, and generate
                credentials. <LearnMore />
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <ConnectionFormSemantic form={form} />

        {connection && (
          <div className="flex flex-col items-start pt-2 text-sm">
            <SyncedConnectionStatus
              syncState={deriveSyncStateFromConnectionList(connection)}
              updatedDate={connection.syncedConnectionUpdatedDate}
              latestLogError={connection.syncedConnectionLatestLogError}
              createdDate={connection.createdDate}
            />
          </div>
        )}
        {children}
      </form>
    </Form>
  );
};

function LearnMore() {
  return (
    <a
      href={DOCUMENTATION_CONNECTIONS_GOOGLE_ANALYTICS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:text-primary"
    >
      Learn more.
    </a>
  );
}
