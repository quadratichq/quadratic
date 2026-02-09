import { ConnectionFormSemantic } from '@/shared/components/connections/ConnectionFormSemantic';
import type { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { SyncedConnection } from '@/shared/components/connections/SyncedConnection';
import { DOCUMENTATION_CONNECTIONS_MIXPANEL_URL } from '@/shared/constants/urls';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ConnectionNameSchema,
  ConnectionSemanticDescriptionSchema,
  ConnectionTypeSchema,
} from 'quadratic-shared/typesAndSchemasConnections';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ConnectionFormMixpanelSchema = z.object({
  name: ConnectionNameSchema,
  semanticDescription: ConnectionSemanticDescriptionSchema,
  type: z.literal(ConnectionTypeSchema.enum.MIXPANEL),
  api_secret: z.string().min(1, { message: 'Required' }),
  project_id: z.string().min(1, { message: 'Required' }),
  start_date: z.string().date(),
});
type FormValues = z.infer<typeof ConnectionFormMixpanelSchema>;

export const useConnectionForm: UseConnectionForm<FormValues> = (connection) => {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const defaultStartDate = threeMonthsAgo.toISOString().split('T')[0];

  const defaultValues: FormValues = {
    name: connection ? connection.name : '',
    semanticDescription: String(connection?.semanticDescription || ''),
    type: 'MIXPANEL',
    api_secret: connection?.typeDetails?.api_secret || '',
    project_id: connection?.typeDetails?.project_id || '',
    start_date: connection?.typeDetails?.start_date || defaultStartDate,
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(ConnectionFormMixpanelSchema),
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
        <p className="pb-2 text-sm">
          Find your Project ID and API secret in your Mixpanel project's Settings → Access Keys.{' '}
          <a
            href={DOCUMENTATION_CONNECTIONS_MIXPANEL_URL}
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
        <FormField
          control={form.control}
          name="project_id"
          render={({ field }) => (
            <FormItem className="col-span-3">
              <FormLabel>Project ID</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="api_secret"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>API secret</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
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

        {/* TODO(ddimaria): implement this once we get the green light */}
        {/* <div className="mb-2 flex flex-row items-center text-xs">
              <Checkbox
                id="show-logs"
                className="mr-2"
                checked={showLogs}
                onCheckedChange={(checked: boolean) => setShowLogs(!!checked)}
              />{' '}
              <label htmlFor="show-logs" className="text-xs">
                Show Logs
              </label>
            </div>
            {showLogs && (
              <SyncedConnectionLogs connectionUuid={connection?.uuid ?? ''} />
            )} */}

        {children}
      </form>
    </Form>
  );
};
