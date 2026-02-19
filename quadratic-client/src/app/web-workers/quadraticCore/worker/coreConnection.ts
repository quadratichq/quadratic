import { debugFlagWait } from '@/app/debugFlags/debugFlags';
import type { ConnectionKind } from '@/app/quadratic-core-types';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { core } from '@/app/web-workers/quadraticCore/worker/core';
import { coreClient } from '@/app/web-workers/quadraticCore/worker/coreClient';

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

  lastTransactionId?: string;

  start = async () => {
    self.sendConnection = this.sendConnection;

    if (await debugFlagWait('debugWebWorkers')) console.log('[coreConnection] initialized.');
  };

  private sendConnection = async (
    transactionId: string,
    x: number,
    y: number,
    sheetId: string,
    code: string,
    connector_type: ConnectionKind,
    connection_id: String
  ) => {
    this.lastTransactionId = transactionId;

    const base = coreClient.env.VITE_QUADRATIC_CONNECTION_URL;
    const kind = connector_type.toLocaleLowerCase().replace(/_/g, '-');
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
      chartPixelWidth: 0,
      chartPixelHeight: 0,
    };
    let signal = this.controller.signal;

    try {
      if (core.teamUuid) {
        const response = await fetch(url, {
          signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
            'X-Team-Id': core.teamUuid,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          std_err = (await response.text()) + `\n\nQuery: ${codeRun.code}`;
          console.warn(std_err);
        } else {
          buffer = await response.arrayBuffer();

          const headers = response.headers;
          const isOverTheLimit = headers.get('over-the-limit') === 'true';
          std_out = isOverTheLimit ? 'Exceeded maximum allowed bytes, not all available records returned.' : '';
          extra = ` in ${headers.get('elapsed-total-ms')}ms`;
        }
      }

      // send the parquet bytes to core
      core.connectionComplete(transactionId, buffer, std_out, std_err?.replace(/\\/g, '').replace(/"/g, ''), extra);
      this.lastTransactionId = undefined;
    } catch (e) {
      console.error(`Error fetching ${url}`, e);
    }
  };

  cancelExecution = () => {
    try {
      this.controller.abort();
    } catch (error: any) {
      // handle the non-abort error only
      if (error.name !== 'AbortError') {
        throw error;
      }
    }

    this.controller = new AbortController();

    // It's possible that the transaction was completed before the message was
    // received.
    if (this.lastTransactionId) {
      const buffer = new ArrayBuffer(0);
      const std_out = undefined;
      const std_err = 'Execution cancelled by user';
      const extra = undefined;
      core.connectionComplete(this.lastTransactionId, buffer, std_out, std_err, extra);
      this.lastTransactionId = undefined;
    }
  };
}

export const coreConnection = new CoreConnection();
