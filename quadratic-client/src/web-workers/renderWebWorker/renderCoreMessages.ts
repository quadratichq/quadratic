import { CoreGridBounds } from '../coreWebWorker/coreMessages';
import { CoreRenderCells, CoreRenderLoad } from '../coreWebWorker/coreRenderMessages';

export type RenderCoreMessage = CoreGridBounds | CoreRenderCells | CoreRenderLoad;
