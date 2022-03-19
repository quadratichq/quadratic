import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import { Simple } from "pixi-cull";
import { ZoomCulling } from "./graphics/zoomCulling";

import drawGridLines from "./graphics/drawGridLines";
import Interaction from "./interaction/interaction";
import Cursor from "./interaction/cursor";
import Globals from "./globals";
import { PixiComponent, useApp } from "@inlet/react-pixi";

export interface ViewportProps {
  screenWidth: number;
  screenHeight: number;
  children?: React.ReactNode;
  cursorRef: React.MutableRefObject<Cursor | undefined>;
  viewportRef: React.MutableRefObject<Viewport | undefined>;
}

export interface PixiComponentViewportProps extends ViewportProps {
  app: PIXI.Application;
  setLoading?: Function;
}

const PixiComponentViewport = PixiComponent("Viewport", {
  create: (props: PixiComponentViewportProps) => {
    const viewport = new Viewport({
      screenWidth: props.screenWidth,
      screenHeight: props.screenHeight,
      worldWidth: 1000,
      worldHeight: 1000,

      interaction: props.app.renderer.plugins.interaction, // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
    });
    // activate plugins
    viewport
      .drag({ pressDrag: false })
      .decelerate()
      .pinch()
      .wheel({ trackpadPinch: true, wheelZoom: false, percent: 1.5 });

    props.viewportRef.current = viewport;

    // set initial position
    viewport.moveCorner(-50, -50);

    function startup() {
      let grid_ui = drawGridLines(viewport);

      const globals = new Globals(viewport, props.app.view, grid_ui);

      let interaction = new Interaction(globals);
      interaction.makeInteractive();
      props.cursorRef.current = interaction.cursor;

      let ticker = PIXI.Ticker.shared;

      // Quadratic Render Loop, render when dirty.
      // Remember when anything changes on the stage to either set viewport.dirty = true
      // Or use a react component that is a child of viewport (React Pixi will trigger a render)
      ticker.add(
        () => {
          if (viewport.dirty) {
            // render
            props.app.renderer.render(props.app.stage);
            viewport.dirty = false;
          }
        },
        null,
        PIXI.UPDATE_PRIORITY.LOW // unsure why but this is recommended to be LOW https://pixijs.download/dev/docs/PIXI.html#UPDATE_PRIORITY
      );

      // Quadratic Culling Loop, run when dirty.
      const cull = new Simple();
      cull.addList(viewport.children);
      ticker.add(
        () => {
          if (viewport.dirty) {
            // cull 2x to the visible viewport
            // this reduces flickering when panning and zooming quickly
            const visibleBounds = viewport.getVisibleBounds();
            const visibleBoundsExtended = new PIXI.Rectangle(
              visibleBounds.x - visibleBounds.width / 2,
              visibleBounds.y - visibleBounds.height / 2,
              visibleBounds.width * 2,
              visibleBounds.height * 2
            );
            cull.cull(visibleBoundsExtended);

            // Zoom culling
            ZoomCulling(globals);
          }
        },
        null,
        PIXI.UPDATE_PRIORITY.NORMAL
      );

      // FPS log
      // ticker.add((time) => {
      //   console.log(`Current Frame Rate: ${props.app.ticker.FPS}`);
      // });

      console.log("[QuadraticGL] environment ready");
    }

    props.app.loader
      .add("OpenSans", "fonts/opensans/OpenSans.fnt")
      .load(startup);

    return viewport;
  },
});

const ViewportComponent = (props: ViewportProps) => {
  const app = useApp();

  return <PixiComponentViewport app={app} {...props} />;
};

export default ViewportComponent;
