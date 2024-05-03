import { debugWebWorkers } from '@/app/debugFlags';
import './multiplayerClient';
import './multiplayerServer';

if (debugWebWorkers) console.log('[multiplayer.worker] created');
