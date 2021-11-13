import * as React from "react";

import { Application, Ticker } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { Simple } from "pixi-cull";

import "./styles.css";
import useWindowDimensions from "./utils/useWindowDimensions.js";

import drawGrid from "./core/graphics/drawGrid";
import fillCell from "./core/graphics/cells/fillCell";
import highlightCell from "./core/graphics/cells/highlightCell";
import { CELL_WIDTH, CELL_HEIGHT } from "./constants/gridConstants";

export default function App() {
  const ref = React.useRef<HTMLDivElement>(null);

  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  console.log("height", windowHeight, "width", windowWidth);

  React.useEffect(() => {
    const app = new Application({
      resizeTo: window,
      resolution: window.devicePixelRatio,
      backgroundColor: 0xffffff,
      autoDensity: true,
    });

    ref.current!.appendChild(app.view);

    app.loader.add("OpenSans", "fonts/opensans/OpenSans.fnt").load(startup);

    function startup() {
      // create viewport
      const viewport = new Viewport({
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
        .wheel({ trackpadPinch: true, wheelZoom: false });

      drawGrid(viewport);

      // Fill 25 Cells with their information
      // for (let i = 0; i < 10000; i++) {
      //   let x = i % 50;
      //   let y = Math.floor(i / 50);
      //   fillCell(viewport, { x: x, y: y }, `Cell (${x}, ${y})`);
      // }

      fillCell(viewport, { x: 1, y: 1 }, `Breed`);
      fillCell(viewport, { x: 1, y: 2 }, `Dachshund`);
      fillCell(viewport, { x: 2, y: 1 }, `Count`);
      fillCell(viewport, { x: 2, y: 2 }, `2`);
      fillCell(viewport, { x: 1, y: 3 }, `Rhodesian`);
      let cell = fillCell(viewport, { x: 2, y: 3 }, `2`);

      // Select Active Cell
      viewport.on("clicked", (event) => {
        console.log(event);
        console.log(event.world.x, event.world.y);
        let cell_x = Math.floor(event.world.x / CELL_WIDTH);
        let cell_y = Math.floor(event.world.y / CELL_HEIGHT);
        console.log(cell_x);

        highlightCell(viewport, { x: cell_x, y: cell_y }, "normal");
      });

      // FPS log
      // app.ticker.add(function (time) {
      //   console.log(app.ticker.FPS);
      // });

      // Culling
      const cull = new Simple(); // new SpatialHash()
      cull.addList(viewport.children);
      cull.cull(viewport.getVisibleBounds()); // TODO: Recalculate on screen resize

      // cull whenever the viewport moves
      let count = 0;
      Ticker.shared.add(() => {
        cell.text = count.toString();
        count += 1;

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
