import { useSyncedConnection } from '@/app/atoms/useSyncedConnection';
import type { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { dateToDateTimeString } from '@/shared/utils/dateTime';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ConnectionNameSchema,
  ConnectionTypeSchema,
  type SyncedConnectionLog,
} from 'quadratic-shared/typesAndSchemasConnections';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ConnectionFormMixpanelSchema = z.object({
  name: ConnectionNameSchema,
  type: z.literal(ConnectionTypeSchema.enum.MIXPANEL),
  api_secret: z.string().min(1, { message: 'Required' }),
  project_id: z.string().min(1, { message: 'Required' }),
  start_date: z.string().date(),
});
type FormValues = z.infer<typeof ConnectionFormMixpanelSchema>;

export const useConnectionForm: UseConnectionForm<FormValues> = (connection) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const defaultStartDate = thirtyDaysAgo.toISOString().split('T')[0];

  const defaultValues: FormValues = {
    name: connection ? connection.name : '',
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
}) => {
  const { getLogs } = useSyncedConnection(connection?.uuid ?? '');
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (connection?.uuid) {
      getLogs().then((fetchedLogs) => setLogs(fetchedLogs));
    }
  }, [connection?.uuid, getLogs]);

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
          <FormField
            control={form.control}
            name="api_secret"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>API Secret</FormLabel>
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
                <FormLabel>Sync Start Date</FormLabel>
                <FormControl>
                  <Input type="date" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="col-span-3">
            <label htmlFor="syncing-progress" className="mb-0 text-sm font-medium">
              Data Sync Status
            </label>
            <p className="mb-2 mt-2 text-xs text-red-500">Syncing progress: {connection?.percentCompleted ?? 0}%</p>
            {logs.map((log: SyncedConnectionLog) => (
              <p key={log.id} className="mb-2 mt-2 text-xs">
                {dateToDateTimeString(new Date(log.createdDate))} - {log.status} - {log.syncedDates.join(', ')}
              </p>
            ))}
          </div>
        </div>
        {children}
      </form>
    </Form>
  );
};
