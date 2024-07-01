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

    let buffer = new ArrayBuffer(0);
    let std_out = '';
    let std_err = '';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        std_err = await response.text();
        console.warn(std_err);
      } else {
        buffer = await response.arrayBuffer();

        const headers = response.headers;
        const isOverTheLimit = headers.get('over-the-limit') === 'true';
        std_out = isOverTheLimit
          ? 'Exceeded maximum allowed bytes, not all available records returned.'
          : `Query returned ${headers.get('record-count')} records in ${headers.get('elapsed-total-ms')} ms.`;
      }

      // send the parquet bytes to core
      core.connectionComplete(transactionId, buffer, std_out, std_err.replace(/\\/g, '').replace(/"/g, ''));
    } catch (e) {
      console.error(`Error fetching ${url}`, e);
    }
  };
}

export const coreConnection = new CoreConnection();
