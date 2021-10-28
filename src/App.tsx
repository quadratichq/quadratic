import * as React from "react";
import "./styles.css";

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

function panCamera(camera: Camera, dx: number, dy: number): Camera {
  let x = camera.x - dx / camera.z;
  let y = camera.y - dy / camera.z;

  // Limit to view bounds
  if (x < -11000) {
    x = -11000;
  }
  if (x > 1000) {
    x = 1000;
  }

  if (y < -16000) {
    y = -16000;
  }
  if (y > 1000) {
    y = 1000;
  }

  return {
    x: x,
    y: y,
    z: camera.z,
  };
}

function zoomCamera(camera: Camera, point: Point, dz: number): Camera {
  let zoom = camera.z - dz * camera.z;

  if (zoom < 0.03) {
    zoom = 0.03;
  }

  const p1 = screenToCanvas(point, camera);
  const p2 = screenToCanvas(point, { ...camera, z: zoom });

  return {
    x: camera.x + (p2.x - p1.x),
    y: camera.y + (p2.y - p1.y),
    z: zoom,
  };
}

function zoomIn(camera: Camera): Camera {
  const i = Math.round(camera.z * 100) / 25;
  const nextZoom = (i + 1) * 0.25;
  const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  return zoomCamera(camera, center, camera.z - nextZoom);
}

function zoomOut(camera: Camera): Camera {
  const i = Math.round(camera.z * 100) / 25;
  const nextZoom = (i - 1) * 0.25;
  const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  return zoomCamera(camera, center, camera.z - nextZoom);
}

export default function App() {
  const ref = React.useRef<HTMLCanvasElement>(null);

  const [camera, setCamera] = React.useState({
    x: 0,
    y: 0,
    z: 1,
  });

  React.useEffect(() => {
    function handleWheel(event: WheelEvent) {
      event.preventDefault();

      const { clientX, clientY, deltaX, deltaY, ctrlKey } = event;

      if (ctrlKey) {
        setCamera((camera) =>
          zoomCamera(camera, { x: clientX, y: clientY }, deltaY / 100)
        );
      } else {
        setCamera((camera) => panCamera(camera, deltaX, deltaY));
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
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.scale(camera.z, camera.z);
    ctx.translate(camera.x, camera.y);

    for (let i = 0; i < 10000; i++) {
      ctx.fillRect((i % 100) * 200, Math.floor(i / 100) * 200, 10, 10);
    }
  });

  return (
    <div>
      <canvas ref={ref} />
      <div>
        <button
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
        </button>
        <div>{Math.floor(camera.z * 100)}%</div>
        <div>x: {Math.floor(viewport.minX)}</div>
        <div>y: {Math.floor(viewport.minY)}</div>
        <div>width: {Math.floor(viewport.width)}</div>
        <div>height: {Math.floor(viewport.height)}</div>
      </div>
    </div>
  );
}
