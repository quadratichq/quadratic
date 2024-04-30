import { debugWebWorkers } from '@/app/debugFlags';
import { events } from '@/app/events/events';

// declare var self: WorkerGlobalScope & typeof globalThis;

class CoreConnector {
  init() {
    if (debugWebWorkers) console.log('[coreConnector] initialized');

    events.on('connector', async (data: any) => {
      console.log('data', data);
      await this.processQuery(data.query);
    });
  }

  async processQuery(query: string): Promise<ArrayBuffer> {
    // const base = import.meta.env.VITE_QUADRATIC_CONNECTOR_URL;
    const base = 'http://localhost:3003';
    const url = `${base}/query_sql?statement=${encodeURIComponent(query)}`;

    const response = await fetch(url);

    return response.arrayBuffer();

    // await quadraticCore.importSql(sheets.sheet.id, buffer, 'sql', { x, y: y + 1 });
  }
}

export const coreConnector = new CoreConnector();
