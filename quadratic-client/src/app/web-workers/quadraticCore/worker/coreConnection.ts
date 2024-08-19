import { debugWebWorkers } from '@/app/debugFlags';
import { ConnectionKind } from '@/app/quadratic-core-types';
import { LanguageState } from '@/app/web-workers/languageTypes';
import { core } from '@/app/web-workers/quadraticCore/worker/core';
import { coreClient } from '@/app/web-workers/quadraticCore/worker/coreClient';
import { CodeRun } from '../../CodeRun';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendConnection: (
      transactionId: string,
      x: number,
      y: number,
      sheetId: string,
      code: string,
      connector_type: ConnectionKind,
      connection_id: String
    ) => void;
  };

class CoreConnection {
  controller: AbortController = new AbortController();

  start() {
    self.sendConnection = this.sendConnection;

    if (debugWebWorkers) console.log('[coreConnection] initialized.');
  }

  private send(message: any) {
    self.postMessage(message);
  }

  sendConnectionState(state: LanguageState, options?: { current?: CodeRun; awaitingExecution?: CodeRun[] }) {
    this.send({
      type: 'coreClientConnectionState',
      state,
      current: options?.current,
      awaitingExecution: options?.awaitingExecution,
    });
  }

  sendConnection = async (
    transactionId: string,
    x: number,
    y: number,
    sheetId: string,
    code: string,
    connector_type: ConnectionKind,
    connection_id: String
  ) => {
    const base = coreClient.env.VITE_QUADRATIC_CONNECTION_URL;
    const kind = connector_type.toLocaleLowerCase();
    const url = `${base}/${kind}/query`;
    const jwt = await coreClient.getJwt();
    const body = {
      connection_id,
      query: code,
    };

    let buffer = new ArrayBuffer(0);
    let std_out = undefined;
    let std_err = undefined;
    let extra = undefined;
    let codeRun: CodeRun = {
      transactionId,
      sheetPos: { x, y, sheetId },
      code,
    };
    let signal = this.controller.signal;

    try {
      this.sendConnectionState('running', { current: codeRun });

      const response = await fetch(url, {
        signal,
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
        std_out = isOverTheLimit ? 'Exceeded maximum allowed bytes, not all available records returned.' : '';
        extra = ` in ${headers.get('elapsed-total-ms')}ms`;
      }

      // send the parquet bytes to core
      core.connectionComplete(transactionId, buffer, std_out, std_err?.replace(/\\/g, '').replace(/"/g, ''), extra);
      this.sendConnectionState('ready');
    } catch (e) {
      console.error(`Error fetching ${url}`, e);
    }
  };

  cancelExecution() {
    try {
      this.controller.abort();
    } catch (error: any) {
      // handle the non-abort error only
      if (error.name !== 'AbortError') {
        throw error;
      }
    }

    this.controller = new AbortController();
    this.sendConnectionState('ready');
  }
}

export const coreConnection = new CoreConnection();
