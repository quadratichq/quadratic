import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { apiClient } from '@/shared/api/apiClient';
import { Connections } from '@/shared/components/connections/Connections';
import { useState } from 'react';
import { LoaderFunctionArgs, useLoaderData } from 'react-router-dom';

export type ConnectionState = {
  loading: 'IDLE' | 'LOADING' | 'ERROR';
  view: { name: 'LIST' } | { name: 'CREATE'; type: 'POSTGRES' | 'MYSQL' } | { name: 'EDIT'; connectionUuid: string };
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { teamUuid } = params;
  if (!teamUuid) throw new Error('No team UUID provided');
  // TODO: (connections) refine types here so it knows typeDetails is required
  const connections = await apiClient.connections.list({ teamUuid });
  return { connections, teamUuid };
};

export const useConnectionsState = () => {
  const state = useState<ConnectionState>({
    loading: 'IDLE',
    view: { name: 'LIST' },
  });

  return state;
};

export const Component = () => {
  const { connections, teamUuid } = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const [state, setState] = useConnectionsState();

  return (
    <>
      <DashboardHeader
        title="Team connections"
        // titleNode={
        //   <DashboardHeaderTitle>
        //     {state.view.name === 'LIST' ? (
        //       'Team connections'
        //     ) : (
        //       <span className="flex items-center gap-1">
        //         <button
        //           className="text-primary underline"
        //           onClick={() =>
        //             setState((prev) => ({
        //               ...prev,
        //               view: { name: 'LIST' },
        //             }))
        //           }
        //         >
        //           Team connections
        //         </button>{' '}
        //         › Create
        //       </span>
        //     )}
        //   </DashboardHeaderTitle>
        // }
      />
      <div className="max-w-lg">
        <Connections
          // @ts-expect-error TODO: (connections) fix types here
          connections={connections}
          teamUuid={teamUuid}
          state={state}
          setState={setState}
        />
      </div>
    </>
  );
};
