/**
 * This file is started as a web worker and is responsible for the core logic of
 * the application.
 *
 * It instantiates:
 * - core.ts: the interface between Rust GridController and this web worker
 * - coreClient.ts: the interface between this web worker and the main thread
 * - coreRender.ts: the interface between this web worker and the render web worker
 */

import { debugWebWorkers } from '@/debugFlags';
import './core';
import './coreClient';
import './coreRender';

if (debugWebWorkers) console.log('[Core WebWorker] created');
