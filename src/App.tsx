import * as React from "react";

import { Application } from "pixi.js";
import { Viewport } from "pixi-viewport";

import "./styles.css";
import useWindowDimensions from "./utils/useWindowDimensions.js";

import drawGrid from "./core/drawGrid";

export default function App() {
  const ref = React.useRef<HTMLDivElement>(null);

  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  console.log("height", windowHeight, "width", windowWidth);

  React.useEffect(() => {
    const app = new Application({
      resizeTo: window,
      backgroundColor: 0xffffff,
    });

    ref.current!.appendChild(app.view);

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
      .drag({
        pressDrag: false, // whether click to drag is active
      })
      .decelerate()
      .pinch()
      .wheel({ trackpadPinch: true, wheelZoom: false });

    drawGrid(viewport);

    return () => {
      // On unload completely destroy the application and all of it's children
      app.destroy(true, true);
    };
  }, []);

  return <div ref={ref} />;
}
