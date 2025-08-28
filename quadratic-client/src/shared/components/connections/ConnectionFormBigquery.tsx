import type { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ConnectionNameSchema,
  ConnectionTypeDetailsBigquerySchema,
  ConnectionTypeSchema,
} from 'quadratic-shared/typesAndSchemasConnections';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ConnectionFormBigquerySchema = z.object({
  name: ConnectionNameSchema,
  semanticDescription: z.string().optional(),
  type: z.literal(ConnectionTypeSchema.enum.BIGQUERY),
  ...ConnectionTypeDetailsBigquerySchema.shape,
});
type FormValues = z.infer<typeof ConnectionFormBigquerySchema>;

export const useConnectionForm: UseConnectionForm<FormValues> = (connection) => {
  const defaultValues: FormValues = {
    name: connection ? connection.name : '',
    type: 'BIGQUERY',
    project_id: connection?.typeDetails?.project_id || '',
    dataset: connection?.typeDetails?.dataset || '',
    service_account_configuration: String(connection?.typeDetails?.service_account_configuration || ''),
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(ConnectionFormBigquerySchema),
    defaultValues,
  });

  return { form };
};

export const ConnectionForm: ConnectionFormComponent<FormValues> = ({ form, children, handleSubmitForm }) => {
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

        <div className="grid grid-cols-4 gap-4">
          <FormField
            control={form.control}
            name="project_id"
            render={({ field }) => (
              <FormItem className="col-span-2">
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
            name="dataset"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Dataset</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4">
          <FormField
            control={form.control}
            name="service_account_configuration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Account Configuration</FormLabel>
                <FormControl>
                  <Textarea
                    autoComplete="off"
                    className="h-48"
                    placeholder="Paste JSON service account configuration here"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {children}
      </form>
    </Form>
  );
};
