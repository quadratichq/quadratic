import { Button } from '@/shared/shadcn/ui/button';
import { useCallback, useEffect, useRef, useState } from 'react';

const CELL_SIZE = 20;
const COLS = 30;
const ROWS = 15;
const CANVAS_W = CELL_SIZE * COLS;
const CANVAS_H = CELL_SIZE * ROWS;
const TICK_MS = 130;
const MIN_TICK_MS = 60;
const TICK_DECREMENT = 2;

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Point = { x: number; y: number };

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

function spawnFood(snake: Point[]): Point {
  let p: Point;
  do {
    p = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
  } while (snake.some((s) => s.x === p.x && s.y === p.y));
  return p;
}

export function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'over'>('idle');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  const snake = useRef<Point[]>([{ x: 15, y: 7 }]);
  const dir = useRef<Direction>('RIGHT');
  const nextDir = useRef<Direction>('RIGHT');
  const food = useRef<Point>({ x: 20, y: 7 });
  const tickMs = useRef(TICK_MS);
  const lastTime = useRef(0);
  const rafId = useRef(0);
  const alive = useRef(false);
  const scoreRef = useRef(0);

  const paint = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_H);
      ctx.stroke();
    }
    for (let i = 1; i < ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_W, i * CELL_SIZE);
      ctx.stroke();
    }

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(
      food.current.x * CELL_SIZE + CELL_SIZE / 2,
      food.current.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 1,
      0,
      Math.PI * 2
    );
    ctx.fill();

    snake.current.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#2563eb' : '#60a5fa';
      ctx.beginPath();
      ctx.roundRect(seg.x * CELL_SIZE + 1, seg.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2, i === 0 ? 4 : 3);
      ctx.fill();
    });
  }, []);

  const loop = useCallback(
    (ts: number) => {
      if (!alive.current) return;

      if (ts - lastTime.current >= tickMs.current) {
        lastTime.current = ts;
        dir.current = nextDir.current;

        const head = { ...snake.current[0] };
        if (dir.current === 'UP') head.y--;
        else if (dir.current === 'DOWN') head.y++;
        else if (dir.current === 'LEFT') head.x--;
        else head.x++;

        if (
          head.x < 0 ||
          head.x >= COLS ||
          head.y < 0 ||
          head.y >= ROWS ||
          snake.current.some((s) => s.x === head.x && s.y === head.y)
        ) {
          alive.current = false;
          setPhase('over');
          paint();
          return;
        }

        snake.current.unshift(head);

        if (head.x === food.current.x && head.y === food.current.y) {
          scoreRef.current++;
          setScore(scoreRef.current);
          setBest((b) => Math.max(b, scoreRef.current));
          food.current = spawnFood(snake.current);
          tickMs.current = Math.max(MIN_TICK_MS, tickMs.current - TICK_DECREMENT);
        } else {
          snake.current.pop();
        }

        paint();
      }

      rafId.current = requestAnimationFrame(loop);
    },
    [paint]
  );

  const start = useCallback(() => {
    snake.current = [{ x: 15, y: 7 }];
    dir.current = 'RIGHT';
    nextDir.current = 'RIGHT';
    food.current = spawnFood(snake.current);
    tickMs.current = TICK_MS;
    scoreRef.current = 0;
    lastTime.current = 0;
    alive.current = true;
    setScore(0);
    setPhase('playing');
    canvasRef.current?.focus();
    paint();
    rafId.current = requestAnimationFrame(loop);
  }, [paint, loop]);

  useEffect(() => {
    paint();
    return () => {
      alive.current = false;
      cancelAnimationFrame(rafId.current);
    };
  }, [paint]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowUp: 'UP',
        ArrowDown: 'DOWN',
        ArrowLeft: 'LEFT',
        ArrowRight: 'RIGHT',
        w: 'UP',
        s: 'DOWN',
        a: 'LEFT',
        d: 'RIGHT',
      };
      const d = map[e.key];
      if (d) {
        e.preventDefault();
        if (alive.current && d !== OPPOSITE[dir.current]) {
          nextDir.current = d;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative rounded-lg border">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          tabIndex={0}
          className="block outline-none ring-primary focus-visible:ring-2"
        />
        {phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 backdrop-blur-[3px]">
            {phase === 'over' && (
              <p className="text-center text-sm font-medium">
                Game over! <br />
                Score: {score} <span className="mx-2 font-normal text-muted-foreground">|</span> Best: {best}
              </p>
            )}
            <Button onClick={start} size="lg" variant="outline" className="bg-background">
              {phase === 'idle' ? 'Play Snake while you wait' : 'Play again'}
            </Button>
            <p className="text-[11px] text-muted-foreground">Arrow keys or WASD to move</p>
          </div>
        )}
      </div>
    </div>
  );
}
