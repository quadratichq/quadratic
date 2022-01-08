import * as React from "react";

import { Application, Ticker } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { Simple } from "pixi-cull";
import { ZoomCulling } from "./graphics/zoomCulling";

import useWindowDimensions from "../utils/useWindowDimensions.js";
import drawGrid from "./graphics/drawGrid";
import Interaction from "./interaction/interaction";
import Grid from "./grid/Grid";
import Globals from "./globals";
import { loadCells } from "./api/Loader";

let viewport: Viewport;

interface QuadraticGridProps {
  isLoading: boolean;
  setIsLoading: Function;
}

export default function QuadraticGrid(props: QuadraticGridProps) {
  const grid_container_ref = React.useRef<HTMLDivElement>(null);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  React.useEffect(() => {
    // Create Pixi App
    const app = new Application({
      resizeTo: window,
      resolution: window.devicePixelRatio,
      backgroundColor: 0xffffff,
      antialias: true,
      autoDensity: true,
    });

    grid_container_ref.current!.appendChild(app.view);

    app.loader.add("OpenSans", "fonts/opensans/OpenSans.fnt").load(startup);

    function startup() {
      // create viewport
      viewport = new Viewport({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        worldWidth: 1000,
        worldHeight: 1000,

        interaction: app.renderer.plugins.interaction, // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
      });

      // add the viewport to the stage
      app.stage.addChild(viewport);

      // activate plugins
      viewport
        .drag({ pressDrag: false })
        .decelerate()
        .pinch()
        .wheel({ trackpadPinch: true, wheelZoom: false, percent: 2.75 });

      let grid_ui = drawGrid(viewport);

      let grid = new Grid(viewport);

      const globals = new Globals(viewport, app.view, grid, grid_ui);

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
      Ticker.shared.add(() => {
        if (viewport.dirty) {
          cull.cull(viewport.getVisibleBounds());

          // Zoom culling
          ZoomCulling(globals);
        }
      });

      setTimeout(() => {
        props.setIsLoading(false);
      }, 3500);
    }

    return () => {
      // On unload completely destroy the application and all of it's children
      app.destroy(true, true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    // tell viewport the new screen size,
    // also updates Culling frame
    if (viewport) {
      viewport.screenWidth = windowWidth;
      viewport.screenHeight = windowHeight;
    }
  }, [windowWidth, windowHeight]);

  if (props.isLoading) {
    return <div style={{ display: "none" }} ref={grid_container_ref}></div>;
  } else {
    return <div ref={grid_container_ref}></div>;
  }
}
