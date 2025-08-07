/**
 * This file is started as a web worker and is responsible for the render logic of
 * the application.
 *
 * It instantiates:
 * - render.ts: the controller for rendering text
 * - renderClient.ts: the interface between this web worker and the main thread
 * - renderCore.ts: the interface between this web worker and the core web worker
 */
import { debugFlagWait } from '@/app/debugFlags/debugFlags';
import './renderClient';

const report = async () => {
  if (await debugFlagWait('debugWebWorkers')) console.log('[render.worker] created');
};

report();
