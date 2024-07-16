import { ConnectionFormComponent, UseConnectionForm } from '@/shared/components/connections/connectionsByType';
import { Button } from '@/shared/shadcn/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ConnectionNameSchema,
  ConnectionTypeDetailsPostgresSchema,
  ConnectionTypeSchema,
} from 'quadratic-shared/typesAndSchemasConnections';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ConnectionFormPostgresSchema = z.object({
  name: ConnectionNameSchema,
  type: z.literal(ConnectionTypeSchema.enum.POSTGRES),
  ...ConnectionTypeDetailsPostgresSchema.shape,
});
type FormValues = z.infer<typeof ConnectionFormPostgresSchema>;

export const useConnectionForm: UseConnectionForm<FormValues> = (connection) => {
  const defaultValues: FormValues = {
    name: connection ? connection.name : '',
    type: 'POSTGRES',
    host: String(connection?.typeDetails?.host || ''),
    port: String(connection?.typeDetails?.port || '5432'),
    database: String(connection?.typeDetails?.database || 'postgres'),
    username: String(connection?.typeDetails?.username || 'postgres'),
    password: String(connection?.typeDetails?.password || ''),
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(ConnectionFormPostgresSchema),
    defaultValues,
  });

  return { form };
};

export const ConnectionForm: ConnectionFormComponent<FormValues> = ({ form, children, handleSubmitForm }) => {
  const [hidePassword, setHidePassword] = useState(false);

  // Hide the password field after a short delay
  // This prevents chrome from asking to save the password
  // because on the first render of the page the input is a text field.
  useEffect(() => {
    setTimeout(() => {
      setHidePassword(true);
    }, 100);
  }, []);

  return (
    <Form {...form}>
      <form
        onSubmit={() => {
          setHidePassword(false); // makes it less likely that the browser will ask to save the password
          form.handleSubmit(handleSubmitForm);
        }}
        className="space-y-2"
        autoComplete="off"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
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
                <FormLabel>Host</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="port"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Port</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
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
              <FormLabel>Database</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
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
                  <div className="relative">
                    <Input autoComplete="off" {...field} type={hidePassword ? 'password' : 'text'} className="pr-14" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0.5 top-0.5 text-muted-foreground hover:bg-transparent"
                      type="button"
                      onClick={() => setHidePassword((prev) => !prev)}
                    >
                      {hidePassword ? 'Show' : 'Hide'}
                    </Button>
                  </div>
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
