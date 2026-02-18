import { ConnectionFormCredentialsHelper } from '@/shared/components/connections/ConnectionFormCredentialsHelper';
import { ConnectionFormIpAllowList } from '@/shared/components/connections/ConnectionFormIpAllowList';
import { ConnectionFormMessageHost } from '@/shared/components/connections/ConnectionFormMessageHost';
import { ConnectionFormSemantic } from '@/shared/components/connections/ConnectionFormSemantic';
import { ConnectionFormSsh } from '@/shared/components/connections/ConnectionFormSsh';
import { ConnectionInputPassword } from '@/shared/components/connections/ConnectionInputPassword';
import type { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ConnectionNameSchema,
  ConnectionSemanticDescriptionSchema,
  ConnectionTypeDetailsMysqlSchema,
  ConnectionTypeSchema,
} from 'quadratic-shared/typesAndSchemasConnections';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ConnectionFormMysqlSchema = z.object({
  name: ConnectionNameSchema,
  semanticDescription: ConnectionSemanticDescriptionSchema,
  type: z.literal(ConnectionTypeSchema.enum.MYSQL),
  ...ConnectionTypeDetailsMysqlSchema.shape,
});
type FormValues = z.infer<typeof ConnectionFormMysqlSchema>;

const DEFAULTS = {
  PORT: '3306',
  DATABASE: 'mysql',
  USERNAME: 'root',
  SSH_PORT: '22',
};

export const useConnectionForm: UseConnectionForm<FormValues> = (connection) => {
  const defaultValues: FormValues = {
    name: connection ? connection.name : '',
    type: 'MYSQL',
    host: String(connection?.typeDetails?.host || ''),
    port: String(connection?.typeDetails?.port || DEFAULTS.PORT),
    database: String(connection?.typeDetails?.database || ''),
    username: String(connection?.typeDetails?.username || ''),
    password: String(connection?.typeDetails?.password || ''),
    useSsh: Boolean(connection?.typeDetails?.useSsh || false),
    sshHost: String(connection?.typeDetails?.sshHost || ''),
    sshPort: String(connection?.typeDetails?.sshPort || DEFAULTS.SSH_PORT),
    sshUsername: String(connection?.typeDetails?.sshUsername || ''),
    semanticDescription: String(connection?.semanticDescription || ''),
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(ConnectionFormMysqlSchema),
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
        <ConnectionFormCredentialsHelper />

        <ConnectionFormIpAllowList />

        <ConnectionFormSsh form={form} />

        <ConnectionFormSemantic form={form} />

        {children}
      </form>
    </Form>
  );
};
