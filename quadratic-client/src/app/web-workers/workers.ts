import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';

// this configures the Monaco editor to use web workers
import './monacoInit';

export const initWorkers = () => {
  renderWebWorker.initWorker();
  multiplayer.initWorker();
  quadraticCore.initWorker();
  pythonWebWorker.initWorker();
  javascriptWebWorker.initWorker();
};
