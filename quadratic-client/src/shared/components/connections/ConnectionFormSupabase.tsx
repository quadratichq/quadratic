import { ConnectionFormMessageHost } from '@/shared/components/connections/ConnectionFormMessageHost';
import { ConnectionInputPassword } from '@/shared/components/connections/ConnectionInputPassword';
import type { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { InfoIcon } from '@/shared/components/Icons';
import { Alert, AlertDescription, AlertTitle } from '@/shared/shadcn/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ConnectionNameSchema,
  ConnectionTypeDetailsSupabaseSchema,
  ConnectionTypeSchema,
} from 'quadratic-shared/typesAndSchemasConnections';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ConnectionFormSupabaseSchema = z.object({
  name: ConnectionNameSchema,
  type: z.literal(ConnectionTypeSchema.enum.SUPABASE),
  ...ConnectionTypeDetailsSupabaseSchema.shape,
});

type FormValues = z.infer<typeof ConnectionFormSupabaseSchema>;

const DEFAULTS = {
  PORT: '5432',
  DATABASE: 'Supabase',
  USERNAME: 'Supabase',
};

export const useConnectionForm: UseConnectionForm<FormValues> = (connection) => {
  const defaultValues: FormValues = {
    name: connection ? connection.name : '',
    type: 'SUPABASE',
    host: String(connection?.typeDetails?.host || ''),
    port: String(connection?.typeDetails?.port || DEFAULTS.PORT),
    database: String(connection?.typeDetails?.database || ''),
    username: String(connection?.typeDetails?.username || ''),
    password: String(connection?.typeDetails?.password || ''),
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(ConnectionFormSupabaseSchema),
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
        <div>
          <Alert className="my-4">
            <InfoIcon className="!text-primary" />
            <AlertTitle className="text-primary">Heads up</AlertTitle>
            <AlertDescription>Use connection information for the Session Pooler.</AlertDescription>
          </Alert>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="host"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Hostname (IP or domain)</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
                <ConnectionFormMessageHost value={field.value} />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="port"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Port number</FormLabel>
                <FormControl>
                  <Input autoComplete="off" placeholder={`e.g. ${DEFAULTS.PORT}`} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="database"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Database name</FormLabel>
              <FormControl>
                <Input autoComplete="off" placeholder={`e.g. ${DEFAULTS.DATABASE}`} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input autoComplete="off" placeholder={`e.g. ${DEFAULTS.USERNAME}`} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <ConnectionInputPassword {...field} />
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
