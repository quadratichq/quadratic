/**
 * Rust Layout Web Worker Entry Point
 *
 * This file is started as a web worker and is responsible for:
 * - Initializing the Rust/WASM layout engine
 * - Processing cell data from core
 * - Generating vertex buffers for the render worker
 * - Communicating with the main thread (client)
 */

import { debugFlagWait } from '@/app/debugFlags/debugFlags';
import './rustLayoutClient';

const report = async () => {
  if (await debugFlagWait('debugWebWorkers')) console.log('[rustLayout.worker] created');
};

report();
