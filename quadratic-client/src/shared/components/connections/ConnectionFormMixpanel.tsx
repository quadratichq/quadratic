import { HelpIcon } from '@/shared/components/Icons';
import { ConnectionFormSemantic } from '@/shared/components/connections/ConnectionFormSemantic';
import type { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { SyncedConnection } from '@/shared/components/connections/SyncedConnection';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
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
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const defaultStartDate = thirtyDaysAgo.toISOString().split('T')[0];

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
              <FormLabel className="inline-flex items-center gap-1">
                Project ID
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      <HelpIcon className="text-muted-foreground" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Found in Project Settings in Mixpanel</TooltipContent>
                </Tooltip>
              </FormLabel>
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
                <FormLabel className="inline-flex items-center gap-1">
                  API secret
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">
                        <HelpIcon className="text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Found in Project Settings → Service Accounts in Mixpanel</TooltipContent>
                  </Tooltip>
                </FormLabel>
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
                <FormLabel className="inline-flex items-center gap-1">
                  Sync start date
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">
                        <HelpIcon className="text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Data will be synced starting from this date</TooltipContent>
                  </Tooltip>
                </FormLabel>
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
