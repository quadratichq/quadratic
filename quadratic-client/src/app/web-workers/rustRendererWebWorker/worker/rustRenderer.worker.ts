/**
 * Rust Renderer Web Worker Entry Point
 *
 * This file is started as a web worker and is responsible for:
 * - Initializing the Rust/WASM renderer
 * - Managing the OffscreenCanvas for WebGPU/WebGL rendering
 * - Communicating with the main thread (client)
 * - Communicating with the core worker (via MessagePort)
 */

import { debugFlagWait } from '@/app/debugFlags/debugFlags';
import './rustRendererClient';

const report = async () => {
  if (await debugFlagWait('debugWebWorkers')) console.log('[rustRenderer.worker] created');
};

report();
