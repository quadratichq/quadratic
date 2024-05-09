import { debugWebWorkers } from '@/app/debugFlags';
import { ConnectionKind } from '@/app/quadratic-core-types';
import { core } from '@/app/web-workers/quadraticCore/worker/core';
import { coreClient } from '@/app/web-workers/quadraticCore/worker/coreClient';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendConnection: (
      transactionId: string,
      query: string,
      connector_type: ConnectionKind,
      connection_id: String
    ) => void;
  };

class CoreConnection {
  start() {
    self.sendConnection = this.sendConnection;

    if (debugWebWorkers) console.log('[coreConnection] initialized.');
  }

  sendConnection = async (
    transactionId: string,
    query: string,
    connector_type: ConnectionKind,
    connection_id: String
  ) => {
    const base = coreClient.env.VITE_QUADRATIC_CONNECTION_URL;
    const kind = connector_type.toLocaleLowerCase();
    const url = `${base}/${kind}/query`;
    const jwt = await coreClient.getJwt();
    const body = {
      connection_id,
      query,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(body),
      });
      const buffer = await response.arrayBuffer();

      // send the parquet bytes to core
      core.connectorComplete(transactionId, buffer);
    } catch (e) {
      console.error(`Error fetching ${url}`, e);
    }
  };
}

export const coreConnection = new CoreConnection();
