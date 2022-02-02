import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import { Simple } from "pixi-cull";
import { ZoomCulling } from "./graphics/zoomCulling";

import drawGrid from "./graphics/drawGrid";
import Interaction from "./interaction/interaction";
import Grid from "./graphics/grid/Grid";
import Globals from "./globals";
import { loadCells } from "./api/Loader";
import { PixiComponent, useApp } from "@inlet/react-pixi";

export interface ViewportProps {
  screenWidth: number;
  screenHeight: number;
  children?: React.ReactNode;
}

export interface PixiComponentViewportProps extends ViewportProps {
  app: PIXI.Application;
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
      .wheel({ trackpadPinch: true, wheelZoom: false, percent: 2.75 });

    function startup() {
      let grid_ui = drawGrid(viewport);

      let grid = new Grid(viewport);

      const globals = new Globals(viewport, props.app.view, grid, grid_ui);

      // Load data from server
      loadCells({ x: -10000, y: -10000 }, { x: 10000, y: 10000 }, globals);

      let interaction = new Interaction(globals);
      interaction.makeInteractive();

      // FPS log
      // app.ticker.add(function (time) {
      //   if (app.ticker.FPS < 50) {
      //     console.log(app.ticker.FPS);
      //   }
      // });

      // Culling
      const cull = new Simple();
      cull.addList(viewport.children); // TODO update on children change?
      PIXI.Ticker.shared.add(() => {
        if (viewport.dirty) {
          cull.cull(viewport.getVisibleBounds());

          // Zoom culling
          ZoomCulling(globals);
        }
      });
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
