import type { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ConnectionNameSchema,
  ConnectionTypeDetailsMixpanelSchema,
  ConnectionTypeSchema,
} from 'quadratic-shared/typesAndSchemasConnections';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ConnectionFormMixpanelSchema = z.object({
  name: ConnectionNameSchema,
  type: z.literal(ConnectionTypeSchema.enum.MIXPANEL),
  ...ConnectionTypeDetailsMixpanelSchema.shape,
});
type FormValues = z.infer<typeof ConnectionFormMixpanelSchema>;

export const useConnectionForm: UseConnectionForm<FormValues> = (connection) => {
  const defaultValues: FormValues = {
    name: connection ? connection.name : '',
    type: 'MIXPANEL',
    api_secret: connection?.typeDetails?.api_secret || '',
    project_id: connection?.typeDetails?.project_id || '',
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(ConnectionFormMixpanelSchema),
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

        <div className="grid grid-cols-3 gap-4">
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
        </div>
        {children}
      </form>
    </Form>
  );
};
