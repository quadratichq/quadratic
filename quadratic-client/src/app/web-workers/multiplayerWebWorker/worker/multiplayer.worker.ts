import { debugWebWorkers } from '@/app/debugFlags';
import '@/app/web-workers/multiplayerWebWorker/worker/multiplayerClient';
import '@/app/web-workers/multiplayerWebWorker/worker/multiplayerServer';

if (debugWebWorkers) console.log('[multiplayer.worker] created');
