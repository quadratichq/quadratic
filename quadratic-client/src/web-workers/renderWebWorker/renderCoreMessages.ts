import { CoreGridBounds } from '../coreWebWorker/coreMessages';
import { CoreRenderCells, CoreRenderReady } from '../coreWebWorker/coreRenderMessages';

export type RenderCoreMessage = CoreGridBounds | CoreRenderCells | CoreRenderReady;
