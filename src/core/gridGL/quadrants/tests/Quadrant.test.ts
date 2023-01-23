import { Rectangle } from 'pixi.js';
import { PixiApp } from '../../pixiApp/PixiApp';
import { Quadrant } from '../Quadrant';
import { QUADRANT_SCALE } from '../quadrantConstants';

describe('Quadrant', () => {

  beforeAll(() => {
    (global as any).window = { devicePixelRatio: 2 };
  });

  let rendered = false;

  const createApp = (rectangle: Rectangle, reducedDrawingRectangle?: Rectangle): PixiApp => {
    rendered = false;
    return {
      prepareForQuadrantRendering: () => 0,
      cleanUpAfterQuadrantRendering: () => 0,
      renderer: {
        render: () => {
          rendered = true;
        }
      },
      sheet: {
        gridOffsets: {
          getScreenRectangle: () => rectangle,
        }
      },
      cells: {
        drawCells: () => reducedDrawingRectangle
      }
    } as any as PixiApp;
  }

  it('creates a Quadrant', () => {
    const visibleRectangle = new Rectangle(0, 0, 100, 100);
    const quadrant = new Quadrant(createApp(visibleRectangle), 0, 0);
    expect(quadrant.dirty).toBe(true);
    expect(quadrant.visibleRectangle).toEqual(new Rectangle(0, 0, 100, 100));
  });

  it('renders a quadrant', () => {
    const visibleRectangle = new Rectangle(0, 0, 100, 100);
    const reducedDrawingRectangle = new Rectangle(1, 2, 3, 4);
    const quadrant = new Quadrant(createApp(visibleRectangle, reducedDrawingRectangle), 0, 0);
    quadrant.update();
    expect(rendered).toBe(true);
    expect(quadrant.x).toBe(0);
    expect(quadrant.y).toBe(0);
  });
});