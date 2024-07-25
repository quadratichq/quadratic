import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';

// this configures the Monaco editor to use web workers
import './monacoInit';

export const initWorkers = () => {
  quadraticCore.initWorker();
  multiplayer.initWorker();
  renderWebWorker.initWorker();
};
