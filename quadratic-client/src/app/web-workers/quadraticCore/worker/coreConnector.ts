import { debugWebWorkers } from '@/app/debugFlags';
import { core } from '@/app/web-workers/quadraticCore/worker/core';
import { coreClient } from '@/app/web-workers/quadraticCore/worker/coreClient';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendConnector: (transactionId: string, query: string) => void;
  };

class CoreConnector {
  start() {
    self.sendConnector = this.sendConnector;

    if (debugWebWorkers) console.log('[coreConnector] initialized.');
  }

  sendConnector = async (transactionId: string, query: string) => {
    const base = coreClient.env.VITE_QUADRATIC_CONNECTOR_URL;
    const url = `${base}/postgres/query?statement=${encodeURIComponent(query)}`;
    try {
      const response = await fetch(url, { method: 'POST', mode: 'no-cors' });
      const buffer = await response.arrayBuffer();

      // send the parquet bytes to core
      core.connectorComplete(transactionId, buffer);
    } catch (e) {
      console.error(`Error fetching ${url}`, e);
    }
  };
}

export const coreConnector = new CoreConnector();
