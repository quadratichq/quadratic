import { SCALE_MODES, Texture, WRAP_MODES } from 'pixi.js';

const THICKNESS = 2;
const DASHED = 8;
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
  canvas.width = horizontal ? DASHED : THICKNESS;
  canvas.height = horizontal ? THICKNESS : DASHED;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Expected context to be defined in createBorderType');
  }
  context.lineWidth = THICKNESS;
  context.strokeStyle = 'white';

  if (horizontal) {
    context.moveTo(0, THICKNESS / 2);
    context.lineTo(DASHED / 2, THICKNESS / 2);
  } else {
    context.moveTo(THICKNESS / 2, 0);
    context.lineTo(THICKNESS / 2, DASHED / 2);
  }
  context.stroke();
  return Texture.from(canvas, { wrapMode: WRAP_MODES.REPEAT, scaleMode: SCALE_MODES.NEAREST });
}

function createDottedLine(horizontal: boolean): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = horizontal ? DOTTED : THICKNESS;
  canvas.height = horizontal ? THICKNESS : DOTTED;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Expected context to be defined in createBorderType');
  }
  context.lineWidth = THICKNESS;
  context.strokeStyle = 'white';

  if (horizontal) {
    context.moveTo(0, THICKNESS / 2);
    context.lineTo(DOTTED / 2, THICKNESS / 2);
  } else {
    context.moveTo(THICKNESS / 2, 0);
    context.lineTo(THICKNESS / 2, DOTTED / 2);
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
