/**
 * This file is started as a web worker and is responsible for the render logic of
 * the application.
 *
 * It instantiates:
 * - render.ts: the controller for rendering text
 * - renderClient.ts: the interface between this web worker and the main thread
 * - renderCore.ts: the interface between this web worker and the core web worker
 */
import { debugWebWorkers } from '@/app/debugFlags';
import '@/app/web-workers/renderWebWorker/worker/renderClient';

if (debugWebWorkers) console.log('[render.worker] created');
