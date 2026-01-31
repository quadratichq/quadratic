import { events } from '@/app/events/events';
import type { LanguageState } from '@/app/web-workers/languageTypes';
import type {
  ClientPythonMessage,
  PythonClientGetJwt,
  PythonClientGetTeamUuid,
  PythonClientMessage,
  PythonClientStockPrices,
} from '@/app/web-workers/pythonWebWorker/pythonClientMessages';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { authClient } from '@/auth/auth';
import { connectionClient } from '@/shared/api/connectionClient';
import { trackEvent } from '@/shared/utils/analyticsEvents';

class PythonWebWorker {
  state: LanguageState = 'loading';

  private worker?: Worker;

  private send(message: ClientPythonMessage, port?: MessagePort) {
    if (!this.worker) throw new Error('Expected worker to be defined in python.ts');
    if (port) {
      this.worker.postMessage(message, [port]);
    } else {
      this.worker.postMessage(message);
    }
  }

  private handleMessage = (message: MessageEvent<PythonClientMessage>) => {
    switch (message.data.type) {
      case 'pythonClientInit':
        this.state = 'ready';
        events.emit('pythonInit', message.data.version);
        this.send({ type: 'clientPythonInit', env: import.meta.env });
        break;

      case 'pythonClientState':
        this.state = message.data.state;
        break;

      case 'pythonClientGetJwt':
        authClient.getTokenOrRedirect(true).then((jwt) => {
          const data = message.data as PythonClientGetJwt;
          this.send({ type: 'clientPythonGetJwt', id: data.id, jwt });
        });
        break;

      case 'pythonClientGetTeamUuid':
        {
          const data = message.data as PythonClientGetTeamUuid;
          const teamUuid = quadraticCore.getTeamUuid();
          this.send({ type: 'clientPythonGetTeamUuid', id: data.id, teamUuid });
        }
        break;

      case 'pythonClientStockPrices':
        {
          const data = message.data as PythonClientStockPrices;
          const teamUuid = quadraticCore.getTeamUuid();

          if (!teamUuid) {
            this.send({
              type: 'clientPythonStockPrices',
              id: data.id,
              data: null,
              error: 'Team UUID not available',
            });
            break;
          }

          connectionClient.financial
            .stockPrices(teamUuid, {
              identifier: data.identifier,
              start_date: data.startDate,
              end_date: data.endDate,
              frequency: data.frequency,
            })
            .then((result) => {
              this.send({
                type: 'clientPythonStockPrices',
                id: data.id,
                data: result.data,
                error: result.error,
              });
            })
            .catch((error) => {
              this.send({
                type: 'clientPythonStockPrices',
                id: data.id,
                data: null,
                error: error.message || 'Unknown error fetching stock prices',
              });
            });
        }
        break;

      default:
        throw new Error(`Unhandled message type ${message.type}`);
    }
  };

  initWorker() {
    this.worker?.terminate();
    this.worker = new Worker(new URL('./worker/python.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;

    const pythonCoreChannel = new MessageChannel();
    this.send({ type: 'clientPythonCoreChannel' }, pythonCoreChannel.port1);
    quadraticCore.sendPythonInit(pythonCoreChannel.port2);
  }

  cancelExecution = () => {
    trackEvent('[PythonWebWorker].restartFromUser');
    this.initWorker();
    quadraticCore.sendCancelExecution('Python');
  };
}

export const pythonWebWorker = new PythonWebWorker();
