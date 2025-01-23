import { events } from '@/app/events/events';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import type { Rectangle } from 'pixi.js';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useRef } from 'react';

// todo: ideally, position would be set via ref instead of render so it doesn't
// flicker when renaming heading or table name where the heading is off the
// screen.

interface Props {
  position?: Rectangle;
  defaultValue?: string;

  // the class name of the input
  className?: string;
  styles?: React.CSSProperties;
  onClose: () => void;
  onSave: (value: string) => void;

  // if true, the input will be the same scale as the app; otherwise it will
  // scale with the viewport
  noScale?: boolean;

  hasBorder?: number;
}

export const PixiRename = (props: Props) => {
  const { position, defaultValue, className, styles, onClose, onSave, noScale, hasBorder } = props;

  // ensure we can wait a tick for the rename to close to avoid a conflict
  // between Escape and Blur
  const closed = useRef(false);

  const close = useCallback(() => {
    closed.current = true;
    onClose();
    focusGrid();
  }, [onClose]);

  // Validates the input value.
  const validate = useCallback((value: string): boolean => {
    if (value.trim().length === 0) {
      return false;
    }
    return true;
  }, []);

  const saveAndClose = useCallback(() => {
    if (closed.current === true) return;
    closed.current = true;
    if (ref.current?.value !== defaultValue && validate(ref.current?.value ?? '')) {
      onSave(ref.current?.value ?? '');
    }
    onClose();
  }, [defaultValue, onClose, onSave, validate]);

  const ref = useRef<HTMLInputElement>(null);

  // focus the input after the position is set
  useEffect(() => {
    if (position) {
      setTimeout(() => {
        if (ref.current) {
          ref.current.select();
          ref.current.focus();
        }
      }, 0);
    }
  }, [position]);

  useEffect(() => {
    const viewportChanged = () => {
      if (ref.current) {
        ref.current.style.transform = `scale(${1 / pixiApp.viewport.scaled})`;
      }
    };
    if (noScale) {
      viewportChanged();
      events.on('viewportChanged', viewportChanged);
    }
  }, [noScale]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        close();
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        saveAndClose();
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [close, saveAndClose]
  );

  const onChange = useCallback(() => {
    if (ref.current) {
      // need to calculate the width of the input using a span with the same css as the input
      const span = document.createElement('span');
      span.className = className ?? '';
      span.style.visibility = 'hidden';
      span.style.whiteSpace = 'pre';
      span.innerText = ref.current.value;
      document.body.appendChild(span);
      ref.current.style.width = `${span.offsetWidth}px`;
      document.body.removeChild(span);
    }
  }, [className]);

  // Need to catch the Blur event via useEffect since the Input goes away when
  // the context menu closes (eg, via a click outside the Input)
  useEffect(() => {
    const input = ref.current;
    return () => {
      if (!closed.current && input) {
        if (input.value !== defaultValue && validate(input.value)) {
          onSave(input.value);
        }
      }
    };
  }, [onSave, defaultValue, validate]);

  if (!position) return null;

  return (
    <Input
      ref={ref}
      className={cn('pointer-events-auto absolute rounded-none border-none outline-none', className)}
      style={{
        left: position.x + (hasBorder ? hasBorder / 2 : 0),
        top: position.y + (hasBorder ? hasBorder / 2 : 0),
        width: position.width - (hasBorder ? hasBorder : 0),
        height: position.height - (hasBorder ? hasBorder : 0),
        transform: noScale ? `scale(${1 / pixiApp.viewport.scaled})` : undefined,
        ...styles,
      }}
      onKeyDown={onKeyDown}
      onChange={onChange}
      defaultValue={defaultValue}
    />
  );
};
