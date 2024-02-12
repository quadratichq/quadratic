import { CoreGridBounds, CoreReady } from '../coreWebWorker/coreMessages';
import { CoreRenderCells } from '../coreWebWorker/coreRenderMessages';

export type RenderCoreMessage = CoreGridBounds | CoreRenderCells | CoreReady;
