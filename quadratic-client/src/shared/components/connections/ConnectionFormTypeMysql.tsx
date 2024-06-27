import { getCreateConnectionAction, getUpdateConnectionAction } from '@/routes/_api.connections';
import { connectionClient } from '@/shared/api/connectionClient';
import { Button } from '@/shared/shadcn/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { ConnectionFormMysqlSchema, ConnectionMysql } from 'quadratic-shared/typesAndSchemasConnections';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSubmit } from 'react-router-dom';
import { z } from 'zod';
import { ConnectionFormActions, ValidateThenTestConnection } from './ConnectionFormActions';

type FormValues = z.infer<typeof ConnectionFormMysqlSchema>;

export function ConnectionFormTypeMysql({
  handleNavigateToListView,
  connection,
}: {
  handleNavigateToListView: () => void;
  connection?: ConnectionMysql;
}) {
  const [hidePassword, setHidePassword] = useState(true);
  const submit = useSubmit();
  const connectionUuid = connection?.uuid;

  const defaultValues: FormValues = connection
    ? {
        name: connection.name,
        type: connection.type,
        host: connection.typeDetails.host,
        port: connection.typeDetails.port,
        database: connection.typeDetails.database,
        username: connection.typeDetails.username,
        password: '',
      }
    : {
        name: '',
        type: 'MYSQL',
        host: '',
        port: '3306',
        database: 'mysql',
        username: 'root',
        password: '',
      };
  const form = useForm<FormValues>({
    resolver: zodResolver(ConnectionFormMysqlSchema),
    defaultValues,
  });

  const onSubmit = (values: FormValues) => {
    const { name, type, ...typeDetails } = values;

    // If nothing changed, don't submit. Just navigate back
    // if (Object.keys(form.formState.dirtyFields).length === 0) {
    //   return;
    // }

    // Update the connection
    if (connectionUuid) {
      const data = getUpdateConnectionAction(connectionUuid, { name, typeDetails });
      submit(data, { action: '/_api/connections', method: 'POST', encType: 'application/json', navigate: false });
      handleNavigateToListView();
      return;
    }

    // Create a new connection
    const data = getCreateConnectionAction({ name, type, typeDetails }, '8b125911-d3c8-490a-91bc-6dbacde16768');
    submit(data, { action: '/_api/connections', method: 'POST', encType: 'application/json', navigate: false });
    handleNavigateToListView();
  };

  // Simulate a form submission to do validation, run the test, return result
  const validateThenTest: ValidateThenTestConnection = () => {
    return new Promise((resolve, reject) => {
      form.handleSubmit(
        async (values) => {
          const { name, type, ...typeDetails } = values;
          resolve(() => connectionClient.test.run({ type: 'mysql', typeDetails }));
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
