import { getDeleteConnectionAction, getUpdateConnectionAction } from '@/routes/file.$uuid.connections.$connectionUuid';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/shadcn/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircularProgress } from '@mui/material';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { ApiTypes, ConnectionTypePostgresSchema } from 'quadratic-shared/typesAndSchemas';
import { ConnectionFormPostgresSchema } from 'quadratic-shared/typesAndSchemasConnections';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useNavigation, useParams, useSubmit } from 'react-router-dom';
import { z } from 'zod';

type ConnectionState = 'idle' | 'loading' | 'success' | 'error';

const FORM_COMPONENTS_BY_TYPE_ID = {
  postgres: PostgresBody,
  mysql: () => <div>TODO: mysql form here</div>,
};

export const ConnectionDialog = ({
  typeId,
  initialData,
}: {
  typeId: keyof typeof FORM_COMPONENTS_BY_TYPE_ID;
  initialData?: ApiTypes['/v0/connections/:uuid.GET.response'];
}) => {
  const { uuid, connectionUuid } = useParams() as { uuid: string; connectionUuid: string };
  const submit = useSubmit();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [connectionState] = useState<ConnectionState>('success');
  const isEdit = Boolean(initialData);

  const onBack = () => {
    navigate(ROUTES.FILE_CONNECTIONS(uuid));
  };

  const onClose = () => {
    navigate(ROUTES.FILE(uuid));
  };
  const onDelete = () => {
    const data = getDeleteConnectionAction(connectionUuid);
    submit(data, { method: 'POST', encType: 'application/json' });
  };

  const isSubmitting = navigation.state !== 'idle';

  const FormComponent = FORM_COMPONENTS_BY_TYPE_ID[typeId];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div>
            <button onClick={onBack} className="flex items-center gap-2 text-xs text-primary">
              <ArrowLeftIcon />
              Connections
            </button>
          </div>
          <DialogTitle>{isEdit ? 'Edit' : 'Create'} Postgres connection</DialogTitle>
          <DialogDescription>
            For more information on setting up Postgres,{' '}
            <a href="#TODO:" className="underline">
              read our docs
            </a>
          </DialogDescription>
        </DialogHeader>

        <FormComponent initialData={initialData} connectionUuid={connectionUuid} />

        <DialogFooter className="flex items-center">
          {/* <Button onClick={onBack} variant="link" className="mr-auto px-0" disabled={isSubmitting}>
            Back
          </Button> */}
          <Button onClick={onDelete} variant="destructive" disabled={isSubmitting} className="mr-auto">
            Delete
          </Button>
          {isSubmitting && <CircularProgress style={{ width: '18px', height: '18px', marginRight: '.25rem' }} />}
          <Button onClick={onClose} variant="outline" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button disabled={isSubmitting || connectionState !== 'success'} form="create-connection" type="submit">
            {isEdit ? 'Save' : 'Create'} connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function PostgresBody({
  initialData,
  connectionUuid,
}: {
  connectionUuid: string;
  initialData?: any /*ApiTypes['/v0/connections/:uuid.GET.response']*/;
}) {
  // TODO: fix these types. May want to consider a more generic form for the data over the wire
  const defaultValues: z.infer<typeof ConnectionFormPostgresSchema> = {
    name: initialData?.name ?? '',
    type: 'POSTGRES',
    host: initialData?.database?.host ?? '',
    port: initialData?.database?.port ?? undefined,
    database: initialData?.database.database ?? '',
    username: initialData?.database.username ?? '',
    password: initialData?.database.password ?? '',
  };
  const submit = useSubmit();

  // TODO: cleanup how this submits empty strings rather than undefined
  const form = useForm<z.infer<typeof ConnectionFormPostgresSchema>>({
    resolver: zodResolver(ConnectionFormPostgresSchema),
    defaultValues,
  });

  const onSubmit = (values: z.infer<typeof ConnectionTypePostgresSchema>) => {
    const { name, type, ...database } = values;

    // Update
    if (initialData) {
      const data = getUpdateConnectionAction(connectionUuid, { name, database });
      submit(data, { method: 'POST', encType: 'application/json' });
      // Create
    } else {
      const data: ApiTypes['/v0/connections.POST.request'] = { name, type, database };
      submit(data, { method: 'POST', encType: 'application/json' });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} id="create-connection" className="space-y-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="My database" autoComplete="off" {...field} />
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
                  <Input placeholder="0.0.0.0" autoComplete="off" {...field} />
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
                  <Input
                    placeholder="5432"
                    autoComplete="off"
                    {...field}
                    onChange={(e) => {
                      // Don't allow non-digits and convert it to a number so it
                      // matches the zod schema
                      const value = e.target.value.replace(/\D/g, '');
                      field.onChange(value === '' ? undefined : Number(value));
                    }}
                  />
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
                  <Input placeholder="********" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
