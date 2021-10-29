import * as React from "react";
import "./styles.css";
import useWindowDimensions from "./utils/useWindowDimensions.js";
import colors from "./utils/colors.js";

interface Point {
  x: number;
  y: number;
}

interface Camera {
  x: number;
  y: number;
  z: number;
}

function screenToCanvas(point: Point, camera: Camera): Point {
  return {
    x: point.x / camera.z - camera.x,
    y: point.y / camera.z - camera.y,
  };
}

function canvasToScreen(point: Point, camera: Camera): Point {
  return {
    x: (point.x - camera.x) * camera.z,
    y: (point.y - camera.y) * camera.z,
  };
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

function getViewport(camera: Camera, box: Box): Box {
  const topLeft = screenToCanvas({ x: box.minX, y: box.minY }, camera);
  const bottomRight = screenToCanvas({ x: box.maxX, y: box.maxY }, camera);

  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y,
    height: bottomRight.x - topLeft.x,
    width: bottomRight.y - topLeft.y,
  };
}

function panCamera(
  camera: Camera,
  dx: number,
  dy: number,
  windowWidth: number,
  windowHeight: number
): Camera {
  let x = camera.x - dx / camera.z;
  let y = camera.y - dy / camera.z;

  // Limit to view bounds
  if (x > 0) {
    x = 0;
  }
  const xlim = -1000 * 10 * camera.z + windowWidth;
  if (x < xlim) {
    x = xlim;
  }

  if (y > 0) {
    y = 0;
  }
  const ylim = -1000 * 10 * camera.z + windowHeight;
  if (y < ylim) {
    y = ylim;
  }

  return {
    x: x,
    y: y,
    z: camera.z,
  };
}

function zoomCamera(
  camera: Camera,
  point: Point,
  dz: number,
  windowWidth: number,
  windowHeight: number
): Camera {
  let zoom = camera.z - dz * camera.z;

  if (zoom < 0.16) {
    zoom = 0.16;
  }

  if (zoom > 1) {
    zoom = 1;
  }

  const p1 = screenToCanvas(point, camera);
  const p2 = screenToCanvas(point, { ...camera, z: zoom });

  return panCamera(
    {
      x: camera.x + (p2.x - p1.x),
      y: camera.y + (p2.y - p1.y),
      z: zoom,
    },
    0,
    0,
    windowWidth,
    windowHeight
  );
}

// function zoomIn(camera: Camera): Camera {
//   const i = Math.round(camera.z * 100) / 25;
//   const nextZoom = (i + 1) * 0.25;
//   const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
//   return zoomCamera(camera, center, camera.z - nextZoom);
// }

// function zoomOut(camera: Camera): Camera {
//   const i = Math.round(camera.z * 100) / 25;
//   const nextZoom = (i - 1) * 0.25;
//   const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
//   return zoomCamera(camera, center, camera.z - nextZoom);
// }

export default function App() {
  const ref = React.useRef<HTMLCanvasElement>(null);

  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  console.log("height", windowHeight, "width", windowWidth);

  // set default camera position
  const [camera, setCamera] = React.useState({
    x: 0,
    y: 0,
    z: 0.2,
  });

  // handle pan and zoom in canvas
  React.useEffect(() => {
    function handleWheel(event: WheelEvent) {
      event.preventDefault();

      const { clientX, clientY, deltaX, deltaY, ctrlKey } = event;

      if (ctrlKey) {
        setCamera((camera) =>
          zoomCamera(
            camera,
            { x: clientX, y: clientY },
            deltaY / 100,
            windowWidth,
            windowHeight
          )
        );
      } else {
        setCamera((camera) =>
          panCamera(camera, deltaX, deltaY, windowWidth, windowHeight)
        );
      }
    }

    const elm = ref.current!;
    elm.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      elm.removeEventListener("wheel", handleWheel);
    };
  }, [ref]);

  const viewport = getViewport(camera, {
    minX: 0,
    minY: 0,
    maxX: window.innerWidth,
    maxY: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
  });

  React.useEffect(() => {
    const cvs = ref.current!;
    cvs.width = window.innerWidth;
    cvs.height = window.innerHeight;
  }, []);

  React.useEffect(() => {
    const cvs = ref.current!;
    const ctx = cvs.getContext("2d")!;

    ctx.resetTransform();
    ctx.clearRect(0, 0, windowWidth, windowHeight);
    ctx.scale(camera.z, camera.z);
    ctx.translate(camera.x, camera.y);

    ctx.fillStyle = colors.gridDots;
    ctx.fillRect(800, 800, 500, 500);
    ctx.fillRect(5000, 4000, 500, 500);

    // draw grid
    for (let i = 0; i < 10000; i++) {
      ctx.fillRect((i % 100) * 100, Math.floor(i / 100) * 100, 5, 5);
    }
  });

  return (
    <div>
      <canvas ref={ref} />
      <div>
        {/* <button
          style={{ position: "relative", zIndex: 9999 }}
          onClick={() => setCamera(zoomIn)}
        >
          Zoom In
        </button>
        <button
          style={{ position: "relative", zIndex: 9999 }}
          onClick={() => setCamera(zoomOut)}
        >
          Zoom Out
        </button> */}
        <div>{Math.floor(camera.z * 100)}%</div>
        <div>x: {Math.floor(viewport.minX)}</div>
        <div>y: {Math.floor(viewport.minY)}</div>
        <div>width: {Math.floor(viewport.width)}</div>
        <div>height: {Math.floor(viewport.height)}</div>
      </div>
    </div>
  );
}
