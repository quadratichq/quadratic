/**
 * This file is started as a web worker and is responsible for the core logic of
 * the application.
 *
 * It instantiates:
 * - core.ts: the interface between Rust GridController and this web worker
 * - coreClient.ts: the interface between this web worker and the main thread
 * - coreRender.ts: the interface between this web worker and the render web worker
 */

import { debugWebWorkers } from '@/app/debugFlags';
import { coreClient } from './coreClient';
import { coreConnection } from './coreConnection';

coreClient.start();
coreConnection.start();

if (debugWebWorkers) console.log('[core.worker] created');
