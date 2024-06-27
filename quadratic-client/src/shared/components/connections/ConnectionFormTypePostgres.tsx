import { getCreateConnectionAction, getUpdateConnectionAction } from '@/routes/_api.connections';
import { connectionClient } from '@/shared/api/connectionClient';
import { Button } from '@/shared/shadcn/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ConnectionFormPostgresSchema } from 'quadratic-shared/typesAndSchemasConnections';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSubmit } from 'react-router-dom';
import { z } from 'zod';
import { ConnectionFormActions, ValidateThenTestConnection } from './ConnectionFormActions';

type FormValues = z.infer<typeof ConnectionFormPostgresSchema>;

export function ConnectionFormTypePostgres({
  initialData,
  handleNavigateToListView,
}: {
  handleNavigateToListView: () => void;
  // TODO: (connections) note this is a very specific kind of get for postgres only, update the type
  initialData?: ApiTypes['/v0/connections/:uuid.GET.response']; // z.infer<typeof ConnectionPostgresSchema>;
}) {
  const [hidePassword, setHidePassword] = useState(true);
  const submit = useSubmit();
  const connectionUuid = initialData?.uuid;

  const defaultValues: FormValues =
    initialData && initialData.type === 'POSTGRES' && initialData.typeDetails
      ? {
          name: initialData.name,
          type: initialData.type,
          host: initialData.typeDetails.host,
          port: initialData.typeDetails.port,
          database: initialData.typeDetails.database,
          username: initialData.typeDetails.username,
          password: initialData.typeDetails.password,
        }
      : {
          name: '',
          type: 'POSTGRES',
          host: '',
          port: '',
          database: '',
          username: '',
          password: '',
        };
  const form = useForm<FormValues>({
    resolver: zodResolver(ConnectionFormPostgresSchema),
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
                  <Input placeholder="My database (production)" autoComplete="off" {...field} autoFocus />
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
                    <Input placeholder="127.0.0.1" autoComplete="off" {...field} />
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
                    <Input placeholder="5432" autoComplete="off" {...field} />
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
                  <Input placeholder="my_database" autoComplete="off" {...field} />
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
                    <Input placeholder="root" autoComplete="off" {...field} />
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
