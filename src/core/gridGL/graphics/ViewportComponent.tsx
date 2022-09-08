import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { Simple } from 'pixi-cull';
import { PixiComponent, useApp } from '@inlet/react-pixi';
import { gridLines } from './gridLines';
import { axesLines } from './axesLines';
import { gridHeadings, OFFSET_HEADINGS } from './gridHeadings';

export interface ViewportProps {
  screenWidth: number;
  screenHeight: number;
  children?: React.ReactNode;
  viewportRef: React.MutableRefObject<Viewport | undefined>;
  onPointerDown: (world: PIXI.Point, event: PointerEvent) => void;
  onPointerMove: (world: PIXI.Point, event: PointerEvent) => void;
  onPointerUp: () => void;
  setHeaderSize: (width: number, height: number) => void;
  showHeadings: boolean;
}

export interface PixiComponentViewportProps extends ViewportProps {
  app: PIXI.Application;
  setLoading?: Function;
}

const PixiComponentViewport = PixiComponent('Viewport', {
  create: (props: PixiComponentViewportProps) => {
    // keep a reference of app on window, used for Playwright tests
    //@ts-expect-error
    window.pixiapp = props.app;

    // Viewport is the component which allows panning and zooming
    const viewport = new Viewport({
      screenWidth: props.screenWidth,
      screenHeight: props.screenHeight,
      interaction: props.app.renderer.plugins.interaction, // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
    });

    // activate plugins
    viewport
      .drag({ pressDrag: false })
      .decelerate()
      .pinch()
      .wheel({ trackpadPinch: true, wheelZoom: false, percent: 1.5 })
      .clampZoom({
        minScale: 0.01,
        maxScale: 10,
      });

    props.viewportRef.current = viewport;

    // if not using OFFSET_HEADINGS, then hardcode the headings offset
    if (!OFFSET_HEADINGS && props.showHeadings) {
      viewport.position.set(20, 20);
    }

    let dirty = true;

    viewport.on('zoomed', () => dirty = true);
    viewport.on('moved', () => dirty = true);

    const gridGraphics = viewport.addChild(new PIXI.Graphics());
    const axesGraphics = viewport.addChild(new PIXI.Graphics());

    const headings = viewport.addChild(new PIXI.Container());
    const headingsGraphics = headings.addChild(new PIXI.Graphics());
    const labels = headings.addChild(new PIXI.Container());
    const corner = headings.addChild(new PIXI.Graphics());

    // Quadratic Render Loop
    // pixi renders when viewport.dirty = true (can be triggered by any component that updates the viewport)
    // headers, grid lines, and axesLines are only updated when dirty = true (which only occurs on a viewport moved or zoomed event)
    PIXI.Ticker.shared.add(
      () => {
        if (viewport.dirty) {
          const cull = new Simple();
          const bounds = viewport.getVisibleBounds();
          cull.cull(bounds);

          if (dirty) {
            gridLines({ viewport, graphics: gridGraphics });
            axesLines({ viewport, graphics: axesGraphics });
            gridHeadings({
              viewport,
              headings,
              graphics: headingsGraphics,
              labels,
              corner,
              setHeaderSize: props.setHeaderSize,
            });
            dirty = false;
          }

          // need to move headings to the end of the scene tree so it's on top of React-added nodes
          viewport.addChild(headings);

          props.app.renderer.render(props.app.stage);
          viewport.dirty = false;
        }
      },
      null,
      PIXI.UPDATE_PRIORITY.LOW // unsure why but this is recommended to be LOW https://pixijs.download/dev/docs/PIXI.html#UPDATE_PRIORITY
    );

    // FPS log
    // ticker.add((time) => {
    //   console.log(`Current Frame Rate: ${props.app.ticker.FPS}`);
    // });

    console.log('[QuadraticGL] environment ready');
    return viewport;
  },

  applyProps: (viewport: Viewport, oldProps: ViewportProps, newProps: ViewportProps) => {
    viewport.off('pointerdown');
    viewport.off('pointermove');
    viewport.off('pointerup');
    viewport.on('pointerdown', (e) => newProps.onPointerDown(viewport.toWorld(e.data.global), e.data.originalEvent));
    viewport.on('pointermove', (e) => newProps.onPointerMove(viewport.toWorld(e.data.global), e.data.originalEvent));
    viewport.on('pointerup', () => newProps.onPointerUp());
    if (oldProps.screenWidth !== newProps.screenWidth || oldProps.screenHeight !== newProps.screenHeight) {
      viewport.resize(newProps.screenWidth, newProps.screenHeight);
    }
  }
});

const ViewportComponent = (props: ViewportProps) => {
  const app = useApp();

  return <PixiComponentViewport app={app} {...props} />;
};

export default ViewportComponent;
