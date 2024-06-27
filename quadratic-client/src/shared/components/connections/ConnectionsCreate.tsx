import { connectionsByType } from '@/app/ui/connections/data';
import { Button } from '@/shared/shadcn/ui/button';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { Link, useParams } from 'react-router-dom';
// @TODO: (connections) move this

type Props = {
  state: any;
  setState: any;
  teamUuid: string;
  connections: ApiTypes['/v0/connections.GET.response'];
};

export const Component = ({ connections, teamUuid, state, setState }: Props) => {
  const { connectionType } = useParams();

  // @ts-expect-error
  const Form = connectionsByType[connectionType]?.Form;
  return (
    <>
      <Form />
      <div className="flex w-full justify-end gap-2">
        <Button variant="outline" asChild>
          <Link to="../../">Cancelz</Link>
        </Button>
        <Button onClick={() => setState({ mode: 'VIEW', modeId: '' })}>Create</Button>
      </div>
    </>
  );
};
