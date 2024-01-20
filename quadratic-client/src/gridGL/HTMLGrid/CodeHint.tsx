import { useRef, useState } from 'react';

export const CodeHint = () => {
  const [hint, setHint] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="code-error-container"
      style={{
        position: 'absolute',
        left: message?.x,
        top: message?.y,
        visibility: message ? 'visible' : 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          ref={textRef}
          className={cn('w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none')}
          style={{
            position: 'absolute',
            right: 0,
            transformOrigin: `calc(${message?.x ?? 0}px + 100%) ${message?.y ?? 0}`,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};
