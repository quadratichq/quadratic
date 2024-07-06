import { SCALE_MODES, Texture, WRAP_MODES } from 'pixi.js';

export const DASHED_THICKNESS = 2;
export const DASHED = 8;
const DOTTED = 4;

interface DashedTexture {
  dottedVertical: Texture;
  dottedHorizontal: Texture;
  dashedVertical: Texture;
  dashedHorizontal: Texture;
}

// fallback to a white texture
export const dashedTextures: DashedTexture = {
  dottedVertical: Texture.EMPTY,
  dottedHorizontal: Texture.EMPTY,
  dashedVertical: Texture.EMPTY,
  dashedHorizontal: Texture.EMPTY,
};

function createDashedLine(horizontal: boolean): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = horizontal ? DASHED : DASHED_THICKNESS;
  canvas.height = horizontal ? DASHED_THICKNESS : DASHED;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Expected context to be defined in createBorderType');
  }
  context.lineWidth = DASHED_THICKNESS;
  context.strokeStyle = 'white';

  if (horizontal) {
    context.moveTo(0, DASHED_THICKNESS / 2);
    context.lineTo(DASHED / 2, DASHED_THICKNESS / 2);
  } else {
    context.moveTo(DASHED_THICKNESS / 2, 0);
    context.lineTo(DASHED_THICKNESS / 2, DASHED / 2);
  }
  context.stroke();
  return Texture.from(canvas, { wrapMode: WRAP_MODES.REPEAT, scaleMode: SCALE_MODES.NEAREST });
}

function createDottedLine(horizontal: boolean): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = horizontal ? DOTTED : DASHED_THICKNESS;
  canvas.height = horizontal ? DASHED_THICKNESS : DOTTED;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Expected context to be defined in createBorderType');
  }
  context.lineWidth = DASHED_THICKNESS;
  context.strokeStyle = 'white';

  if (horizontal) {
    context.moveTo(0, DASHED_THICKNESS / 2);
    context.lineTo(DOTTED / 2, DASHED_THICKNESS / 2);
  } else {
    context.moveTo(DASHED_THICKNESS / 2, 0);
    context.lineTo(DASHED_THICKNESS / 2, DOTTED / 2);
  }
  context.stroke();
  return Texture.from(canvas, { wrapMode: WRAP_MODES.REPEAT, scaleMode: SCALE_MODES.NEAREST });
}

export function createBorderTypes(): void {
  dashedTextures.dashedHorizontal = createDashedLine(true);
  dashedTextures.dashedVertical = createDashedLine(false);
  dashedTextures.dottedHorizontal = createDottedLine(true);
  dashedTextures.dottedVertical = createDottedLine(false);
}
