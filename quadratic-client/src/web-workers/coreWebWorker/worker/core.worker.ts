/**
 * This file is started as a web worker and is responsible for the core logic of
 * the application.
 *
 * It instantiates:
 * - core: the interface between Rust GridController and this web worker
 * - coreClient: the interface between this web worker and the main thread
 * - coreRender: the interface between this web worker and the render web worker
 */

import { debugWebWorkers } from '@/debugFlags';
import './core';
import './coreClient';
import './coreRender';

if (debugWebWorkers) console.log('[Core WebWorker] created');
