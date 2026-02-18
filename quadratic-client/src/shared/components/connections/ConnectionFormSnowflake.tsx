import { ConnectionFormCredentialsHelper } from '@/shared/components/connections/ConnectionFormCredentialsHelper';
import { ConnectionFormIpAllowList } from '@/shared/components/connections/ConnectionFormIpAllowList';
import { ConnectionFormSemantic } from '@/shared/components/connections/ConnectionFormSemantic';
import { ConnectionInputPassword } from '@/shared/components/connections/ConnectionInputPassword';
import type { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ConnectionNameSchema,
  ConnectionSemanticDescriptionSchema,
  ConnectionTypeDetailsSnowflakeSchema,
  ConnectionTypeSchema,
} from 'quadratic-shared/typesAndSchemasConnections';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ConnectionFormSnowflakeSchema = z.object({
  name: ConnectionNameSchema,
  semanticDescription: ConnectionSemanticDescriptionSchema,
  type: z.literal(ConnectionTypeSchema.enum.SNOWFLAKE),
  ...ConnectionTypeDetailsSnowflakeSchema.shape,
});
type FormValues = z.infer<typeof ConnectionFormSnowflakeSchema>;

export const useConnectionForm: UseConnectionForm<FormValues> = (connection) => {
  const defaultValues: FormValues = {
    name: connection ? connection.name : '',
    type: 'SNOWFLAKE',
    account_identifier: String(connection?.typeDetails?.account_identifier || ''),
    database: String(connection?.typeDetails?.database || ''),
    username: String(connection?.typeDetails?.username || ''),
    password: String(connection?.typeDetails?.password || ''),
    warehouse: String(connection?.typeDetails?.warehouse || ''),
    role: String(connection?.typeDetails?.role || ''),
    semanticDescription: String(connection?.semanticDescription || ''),
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(ConnectionFormSnowflakeSchema),
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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="account_identifier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Identifier</FormLabel>
                <FormControl>
                  <Input autoComplete="off" placeholder="e.g. jovlpvc-axb93678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="database"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Database name</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="warehouse"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Warehouse (optional)</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role (optional)</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
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
        <ConnectionFormCredentialsHelper />

        <ConnectionFormIpAllowList />

        <ConnectionFormSemantic form={form} />

        {children}
      </form>
    </Form>
  );
};
