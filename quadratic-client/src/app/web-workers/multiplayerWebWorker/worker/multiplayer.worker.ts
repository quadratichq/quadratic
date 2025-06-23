import { debugFlag } from '@/app/debugFlags/debugFlags';
import './multiplayerClient';
import './multiplayerServer';

if (debugFlag('debugWebWorkers')) console.log('[multiplayer.worker] created');
