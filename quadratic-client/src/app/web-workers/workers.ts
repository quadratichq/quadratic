import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';

// this configures the Monaco editor to use web workers
import { debugFlag } from '@/app/debugFlags/debugFlags';
import './monacoInit';

export const initWorkers = () => {
  renderWebWorker.initWorker();
  multiplayer.initWorker();
  quadraticCore.initWorker();

  if (debugFlag('debugWebWorkers')) console.log('[workers] all workers started');
};

export const stopWorkers = () => {
  quadraticCore.terminateWorker();
  multiplayer.terminate();
  renderWebWorker.terminate();

  if (debugFlag('debugWebWorkers')) console.log('[workers] all workers stopped');
};

export const allWorkerAreInitialized = () => {
  return renderWebWorker.isInitialized() && multiplayer.isInitialized() && quadraticCore.isInitialized();
};
