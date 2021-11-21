import * as React from "react";
import { Application, Ticker } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { Simple } from "pixi-cull";

import "./styles.css";
import useWindowDimensions from "./utils/useWindowDimensions.js";
import drawGrid from "./core/graphics/drawGrid";
import Interaction from "./core/interaction/interaction";
import Grid from "./core/grid/Grid";
import Globals from "./globals";
import { loadCells } from "./core/api/Loader";

let viewport: Viewport;

export default function App() {
  const ref = React.useRef<HTMLDivElement>(null);
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

    ref.current!.appendChild(app.view);

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
        .wheel({ trackpadPinch: true, wheelZoom: false, percent: 2 });

      drawGrid(viewport);

      let grid = new Grid(viewport);

      const globals = new Globals(viewport, app.view, grid);

      // Load data from server
      loadCells({ x: -10000, y: -10000 }, { x: 10000, y: 10000 }, globals);

      let interaction = new Interaction(globals);
      interaction.makeInteractive();

      // FPS log
      // app.ticker.add(function (time) {
      //   console.log(app.ticker.FPS);
      // });

      // Culling
      const cull = new Simple();
      cull.addList(viewport.children); // TODO update on children change?
      Ticker.shared.add(() => {
        if (viewport.dirty) {
          cull.cull(viewport.getVisibleBounds());
          viewport.dirty = false;
        }
      });
    }

    return () => {
      // On unload completely destroy the application and all of it's children
      app.destroy(true, true);
    };
  }, []);

  React.useEffect(() => {
    // tell viewport the new screen size,
    // also updates culling frame
    if (viewport) {
      viewport.screenWidth = windowWidth;
      viewport.screenHeight = windowHeight;
    }
  }, [windowWidth, windowHeight]);

  return <div ref={ref} />;
}

// Prevent window zooming on Chrome
window.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
  },
  { passive: false }
);
