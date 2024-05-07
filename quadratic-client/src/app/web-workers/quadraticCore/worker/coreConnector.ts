import { debugWebWorkers } from '@/app/debugFlags';
import { core } from '@/app/web-workers/quadraticCore/worker/core';
import { coreClient } from '@/app/web-workers/quadraticCore/worker/coreClient';
import { v4 as uuid } from 'uuid';

export interface JwtRequest {
  type: 'coreClientGetJwt';
  id: string;
}

type Request = JwtRequest;

export interface JwtResponse {
  type: 'clientCoreJwt';
  id: string;
  payload: { jwt: string };
}

type Response = JwtResponse;

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendConnector: (transactionId: string, query: string) => void;
  };

class CoreConnector {
  private promises = new Map<string, (...args: any[]) => void>();

  start() {
    self.sendConnector = this.sendConnector;

    if (debugWebWorkers) console.log('[coreConnector] initialized.');
  }

  private send(message: Request) {
    self.postMessage(message);
  }

  async receive(response: Response) {
    await this.promises.get(response.id)!(response.payload);
    this.promises.delete(response.id);
  }

  sendConnector = async (transactionId: string, query: string) => {
    let id = uuid();

    this.promises.set(id, async (jwt: string) => {
      const base = coreClient.env.VITE_QUADRATIC_CONNECTOR_URL;
      const url = `${base}/postgres/query?statement=${encodeURIComponent(query)}`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const buffer = await response.arrayBuffer();

        // send the parquet bytes to core
        core.connectorComplete(transactionId, buffer);
      } catch (e) {
        console.error(`Error fetching ${url}`, e);
      }
    });

    this.send({
      type: 'coreClientGetJwt',
      id: id,
    });
  };
}

export const coreConnector = new CoreConnector();
