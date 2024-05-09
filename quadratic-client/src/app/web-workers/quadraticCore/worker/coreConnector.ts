import { debugWebWorkers } from '@/app/debugFlags';
import { ConnectorKind } from '@/app/quadratic-core-types';
import { core } from '@/app/web-workers/quadraticCore/worker/core';
import { coreClient } from '@/app/web-workers/quadraticCore/worker/coreClient';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendConnector: (transactionId: string, query: string, connector_type: ConnectorKind, connection_id: String) => void;
  };

class CoreConnector {
  start() {
    self.sendConnector = this.sendConnector;

    if (debugWebWorkers) console.log('[coreConnector] initialized.');
  }

  sendConnector = async (
    transactionId: string,
    query: string,
    connector_type: ConnectorKind,
    connection_id: String
  ) => {
    const base = coreClient.env.VITE_QUADRATIC_CONNECTOR_URL;
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

export const coreConnector = new CoreConnector();
