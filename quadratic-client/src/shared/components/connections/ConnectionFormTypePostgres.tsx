import { connectionClient } from '@/shared/api/connectionClient';
import { ConnectionFormProps } from '@/shared/components/connections/ConnectionForm';
import { Button } from '@/shared/shadcn/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ConnectionNameSchema,
  ConnectionTypeDetailsPostgresSchema,
  ConnectionTypeSchema,
} from 'quadratic-shared/typesAndSchemasConnections';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ConnectionFormActions, ValidateThenTestConnection } from './ConnectionFormActions';

const ConnectionFormPostgresSchema = z.object({
  name: ConnectionNameSchema,
  type: z.literal(ConnectionTypeSchema.enum.POSTGRES),
  ...ConnectionTypeDetailsPostgresSchema.shape,
});
type FormValues = z.infer<typeof ConnectionFormPostgresSchema>;

export function ConnectionFormTypePostgres({
  handleSubmitForm,
  handleNavigateToListView,
  connection,
}: ConnectionFormProps) {
  const [hidePassword, setHidePassword] = useState(true);
  const connectionUuid = connection?.uuid;

  const defaultValues: FormValues = {
    name: connection ? connection.name : '',
    type: 'POSTGRES',
    host: connection ? String(connection.typeDetails.host) : '',
    port: connection ? String(connection.typeDetails.port) : '5432',
    database: connection ? String(connection.typeDetails.database) : 'postgres',
    username: connection ? String(connection.typeDetails.username) : 'postgres',
    password: '',
  };
  const form = useForm<FormValues>({
    resolver: zodResolver(ConnectionFormPostgresSchema),
    defaultValues,
  });

  const onSubmit = (values: FormValues) => {
    const { name, type, ...typeDetails } = values;
    handleSubmitForm({ name, type, typeDetails });
  };

  // Simulate a form submission to do validation, run the test, return result
  const validateThenTest: ValidateThenTestConnection = () => {
    return new Promise((resolve, reject) => {
      form.handleSubmit(
        async (values) => {
          const { name, type, ...typeDetails } = values;
          resolve(() => connectionClient.test.run({ type: 'postgres', typeDetails }));
        },
        () => {
          reject();
        }
      )();
    });
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
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
                      <Input
                        autoComplete="off"
                        {...field}
                        type={hidePassword ? 'password' : 'text'}
                        className="pr-14"
                      />
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
          <ConnectionFormActions
            form={form}
            validateThenTest={validateThenTest}
            handleNavigateToListView={handleNavigateToListView}
            connectionUuid={connectionUuid}
          />
        </form>
      </Form>
    </>
  );
}
