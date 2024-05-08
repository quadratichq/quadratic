import { ConnectionTest } from '@/app/ui/components/ConnectionTest';
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
import { ConnectionNameSchema, ConnectionTypeDetailsPostgresSchema } from 'quadratic-shared/typesAndSchemasConnections';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useNavigation, useParams, useSubmit } from 'react-router-dom';
import { z } from 'zod';

const FORM_COMPONENTS_BY_TYPE_ID = {
  postgres: PostgresBody,
  mysql: () => <div>TODO: mysql form here</div>,
};

const FORM_ID = 'create-connection';

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
          {isEdit && (
            <Button onClick={onDelete} variant="destructive" disabled={isSubmitting} className="mr-auto">
              Delete
            </Button>
          )}
          {isSubmitting && <CircularProgress style={{ width: '18px', height: '18px', marginRight: '.25rem' }} />}
          <Button onClick={onClose} variant="outline" disabled={isSubmitting}>
            Cancel
          </Button>

          <Button disabled={isSubmitting} form={FORM_ID} type="submit">
            {isEdit ? 'Save changes' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ConnectionFormPostgresSchema = z.object({
  name: ConnectionNameSchema,
  type: ConnectionTypePostgresSchema.shape.type,
  ...ConnectionTypeDetailsPostgresSchema.shape,
});

function PostgresBody({
  initialData,
  connectionUuid,
}: {
  connectionUuid: string;
  // TODO: note this is a very specific kind of get for postgres only, update the type
  initialData?: any; // z.infer<typeof ConnectionPostgresSchema>;
}) {
  const [hidePassword, setHidePassword] = useState(true);

  const defaultValues: z.infer<typeof ConnectionFormPostgresSchema> =
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
  const submit = useSubmit();

  // TODO: cleanup how this submits empty strings rather than undefined
  const form = useForm<z.infer<typeof ConnectionFormPostgresSchema>>({
    resolver: zodResolver(ConnectionFormPostgresSchema),
    defaultValues,
  });

  const onSubmit = (values: z.infer<typeof ConnectionTypePostgresSchema>) => {
    const { name, type, ...typeDetails } = values;

    // Update
    if (initialData) {
      const data = getUpdateConnectionAction(connectionUuid, { name, typeDetails });
      submit(data, { method: 'POST', encType: 'application/json' });
      // Create
    } else {
      const data: ApiTypes['/v0/connections.POST.request'] = { name, type, typeDetails };
      submit(data, { method: 'POST', encType: 'application/json' });
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} id={FORM_ID} className="space-y-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="My database (production)" autoComplete="off" {...field} />
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
        </form>
      </Form>
      <ConnectionTest form={form} />
    </>
  );
}
