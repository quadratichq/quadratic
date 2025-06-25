/**
 * This file is started as a web worker and is responsible for the core logic of
 * the application.
 *
 * It instantiates:
 * - core.ts: the interface between Rust GridController and this web worker
 * - coreClient.ts: the interface between this web worker and the main thread
 * - coreRender.ts: the interface between this web worker and the render web worker
 */

import { debugFlagWait } from '@/app/debugFlags/debugFlags';
import { coreClient } from '@/app/web-workers/quadraticCore/worker/coreClient';
import { coreConnection } from '@/app/web-workers/quadraticCore/worker/coreConnection';

coreClient.start();
coreConnection.start();

const report = async () => {
  if (await debugFlagWait('debugWebWorkers')) console.log('[core.worker] created');
};

report();
