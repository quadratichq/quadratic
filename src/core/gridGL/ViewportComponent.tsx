import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import { Simple } from "pixi-cull";
import { ZoomCulling } from "./graphics/zoomCulling";

import drawGridLines from "./graphics/drawGridLines";
import Interaction from "./interaction/interaction";
import Cursor from "./interaction/cursor";
import Globals from "./globals";
import { PixiComponent, useApp } from "@inlet/react-pixi";
import { width } from "@mui/system";

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
      .wheel({ trackpadPinch: true, wheelZoom: false, percent: 2.5 });

    props.viewportRef.current = viewport;

    function startup() {
      let grid_ui = drawGridLines(viewport);

      const globals = new Globals(viewport, props.app.view, grid_ui);

      // Load data from server
      // loadCells({ x: -10000, y: -10000 }, { x: 10000, y: 10000 }, globals);

      let interaction = new Interaction(globals);
      interaction.makeInteractive();
      props.cursorRef.current = interaction.cursor;

      // FPS log
      // props.app.ticker.add(function (time) {
      //   if (props.app.ticker.FPS < 50) {
      //     console.log(`Current Frame Rate: ${props.app.ticker.FPS}`);
      //   }
      // });

      // Custom Render Loop
      const cull = new Simple();
      const renderer = props.app.renderer;
      cull.addList(viewport.children);
      let frames_to_render = 1;
      let ticker = PIXI.Ticker.shared;
      ticker.speed = 1;
      ticker.add(
        () => {
          // Add more frames whenever dirty
          if (viewport.dirty && frames_to_render < 60) frames_to_render = 60;

          if (frames_to_render > 0) {
            // if (viewport.dirty) {

            // render
            renderer.render(props.app.stage);

            viewport.dirty = false;
            frames_to_render--;

            console.log("render");
          }
        },
        null,
        PIXI.UPDATE_PRIORITY.HIGH
      );

      ticker.add(
        () => {
          if (frames_to_render > 0) {
            // cull

            const visibleBounds = viewport.getVisibleBounds();
            const visibleBoundsExtended = new PIXI.Rectangle(
              visibleBounds.x - 1000,
              visibleBounds.y - 1000,
              visibleBounds.width + 2000,
              visibleBounds.height + 2000
            );

            cull.cull(visibleBoundsExtended);

            // Zoom culling
            ZoomCulling(globals);
          }
        },
        null,
        PIXI.UPDATE_PRIORITY.NORMAL
      );

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
