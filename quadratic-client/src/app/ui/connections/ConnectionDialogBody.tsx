import { ConnectionsBreadcrumb } from '@/app/ui/connections/ConnectionsBreadcrumb';
import { connectionsByType } from '@/app/ui/connections/data';
import { getDeleteConnectionAction } from '@/routes/file.$uuid.connections.$connectionUuid';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { CircularProgress } from '@mui/material';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useNavigate, useNavigation, useParams, useSubmit } from 'react-router-dom';

export const CONNECTION_FORM_ID = 'create-or-edit-connection';

export const ConnectionDialogBody = ({
  connectionType,
  initialData,
}: {
  connectionType: ConnectionType;
  initialData?: ApiTypes['/v0/connections/:uuid.GET.response'];
}) => {
  const { uuid, connectionUuid } = useParams() as { uuid: string; connectionUuid: string };
  const submit = useSubmit();
  const navigate = useNavigate();
  const navigation = useNavigation();

  const isEdit = Boolean(initialData);
  const isSubmitting = navigation.state !== 'idle';
  const FormComponent = connectionsByType[connectionType].Form;
  const connectionName = connectionsByType[connectionType].name;
  const connectionDocsLink = connectionsByType[connectionType].docsLink;

  const handleCancel = () => {
    navigate(ROUTES.FILE_CONNECTIONS(uuid));
  };
  const handleDelete = () => {
    const data = getDeleteConnectionAction(connectionUuid);
    submit(data, { method: 'POST', encType: 'application/json' });
  };

  return (
    <>
      <DialogHeader>
        <ConnectionsBreadcrumb />
        <DialogTitle>{connectionName} connection</DialogTitle>
        <DialogDescription>
          For more information on {connectionName} connections,{' '}
          <a href={connectionDocsLink} target="_blank" rel="noreferrer" className="underline hover:text-primary">
            read the docs
          </a>
        </DialogDescription>
      </DialogHeader>

      <FormComponent initialData={initialData} connectionUuid={connectionUuid} />

      <DialogFooter className="flex items-center">
        {isEdit && (
          <Button onClick={handleDelete} variant="destructive" disabled={isSubmitting} className="mr-auto">
            Delete
          </Button>
        )}
        {isSubmitting && <CircularProgress style={{ width: '18px', height: '18px', marginRight: '.25rem' }} />}
        <Button onClick={handleCancel} variant="outline" disabled={isSubmitting}>
          Cancel
        </Button>

        <Button disabled={isSubmitting} form={CONNECTION_FORM_ID} type="submit">
          {isEdit ? 'Save changes' : 'Create'}
        </Button>
      </DialogFooter>
    </>
  );
};
