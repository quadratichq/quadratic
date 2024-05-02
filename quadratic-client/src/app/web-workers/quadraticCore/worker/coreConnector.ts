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
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    // send the parquet bytes to core
    core.connectorComplete(transactionId, buffer);
  };
}

export const coreConnector = new CoreConnector();
