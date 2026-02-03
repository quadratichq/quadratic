import { HelpIcon } from '@/shared/components/Icons';
import type { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { ConnectionFormSemantic } from '@/shared/components/connections/ConnectionFormSemantic';
import { SyncedConnection } from '@/shared/components/connections/SyncedConnection';
import { DOCUMENTATION_CONNECTIONS_GOOGLE_ANALYTICS_URL } from '@/shared/constants/urls';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
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
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const defaultStartDate = thirtyDaysAgo.toISOString().split('T')[0];

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
                <FormLabel className="inline-flex items-center gap-1">
                  Property ID
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">
                        <HelpIcon className="text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Found in Admin → Property Settings in Google Analytics</TooltipContent>
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
        <FormField
          control={form.control}
          name="service_account_configuration"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="inline-flex items-center gap-1">
                Service account configuration (JSON)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      <HelpIcon className="text-muted-foreground" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>JSON key file from Google Cloud Console service account</TooltipContent>
                </Tooltip>
              </FormLabel>
              <FormControl>
                <Textarea autoComplete="off" {...field} className="h-48" />
              </FormControl>
              <a
                href={DOCUMENTATION_CONNECTIONS_GOOGLE_ANALYTICS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline hover:text-primary"
              >
                Learn how to find Google Analytics connection details
              </a>
              <FormMessage />
            </FormItem>
          )}
        />

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
