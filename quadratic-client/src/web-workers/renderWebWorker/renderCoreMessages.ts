import { CoreGridBounds } from '../coreWebWorker/coreMessages';
import { CoreRenderCells } from '../coreWebWorker/coreRenderMessages';

export type RenderCoreMessage = CoreGridBounds | CoreRenderCells;
