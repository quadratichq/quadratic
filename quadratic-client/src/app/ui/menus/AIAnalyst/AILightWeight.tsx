import { sheets } from '@/app/grid/controller/Sheets';
import { ScrollBars } from '@/app/gridGL/HTMLGrid/scrollBars/ScrollBars';
import { LightWeightApp } from '@/app/gridGL/lightweightApp/LightWeightApp';
import { selectionToSheetRect } from '@/app/quadratic-core/quadratic_core';
import { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useState } from 'react';

interface Props {
  height: number;
  a1: string;

  // this is used as a key
  uniqueName: string;
}

export const AILightWeight = (props: Props) => {
  const [app, setApp] = useState<LightWeightApp | null>(null);
  const [rectangle, setRectangle] = useState<Rectangle | undefined>();
  const [maxSize, setMaxSize] = useState<{ maxWidth: number; maxHeight: number }>({ maxWidth: 0, maxHeight: 0 });

  const ref = useCallback(
    (div: HTMLDivElement) => {
      if (!div) return;
      const app = new LightWeightApp(div);
      setApp(app);
      try {
        const range = selectionToSheetRect(sheets.current, props.a1, sheets.jsA1Context);
        const { width, height } = app.reposition(
          Number(range.min.x),
          Number(range.min.y),
          Number(range.max.x),
          Number(range.max.y)
        );
        setRectangle(
          new Rectangle(
            Number(range.min.x),
            Number(range.min.y),
            Number(range.max.x - range.min.x),
            Number(range.max.y - range.min.y)
          )
        );
        setMaxSize({ maxWidth: width, maxHeight: height });
      } catch {}
    },
    [props.a1]
  );

  useEffect(() => {
    return () => {
      if (app) {
        app.destroy();
      }
    };
  }, [app]);

  return (
    <div className="border bg-blue-200">
      <div className="bold px-1">{props.a1}</div>
      <div
        ref={ref}
        className="relative"
        style={{
          maxWidth: maxSize.maxWidth,
          width: 'calc(100% - 8px)',
          maxHeight: maxSize.maxHeight,
          height: props.height,
        }}
      >
        {app && <ScrollBars baseApp={app} uniqueName={props.uniqueName} rectangle={rectangle} />}
      </div>
    </div>
  );
};
