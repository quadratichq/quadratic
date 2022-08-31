import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { Simple } from 'pixi-cull';
import { PixiComponent, useApp } from '@inlet/react-pixi';

export interface ViewportProps {
  screenWidth: number;
  screenHeight: number;
  children?: React.ReactNode;
  viewportRef: React.MutableRefObject<Viewport | undefined>;
  onPointerDown: (world: PIXI.Point, event: PointerEvent) => void;
  onPointerMove: (world: PIXI.Point, event: PointerEvent) => void;
  onPointerUp: () => void;
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

    // set initial position
    viewport.moveCorner(0, 0);

    // Quadratic Render Loop, render when dirty.
    // Remember when anything changes on the stage to either set viewport.dirty = true
    // Or use a react component that is a child of viewport (React Pixi will trigger a render)
    PIXI.Ticker.shared.add(
      () => {
        if (viewport.dirty) {
          const cull = new Simple();
          cull.addList(viewport.children);
          const bounds = viewport.getVisibleBounds();
          cull.cull(bounds);
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

  applyProps(viewport: Viewport, oldProps: ViewportProps, newProps: ViewportProps) {
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
