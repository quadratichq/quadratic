import { sheets } from '@/app/grid/controller/Sheets';
import { LightWeightApp } from '@/app/gridGL/lightweightApp/LightWeightApp';
import { selectionToSheetRect } from '@/app/quadratic-core/quadratic_core';
import { useCallback, useState } from 'react';

interface Props {
  height: number;
  a1: string;
}

export const AILightWeight = (props: Props) => {
  const [lightWeightApp, setLightWeightApp] = useState<LightWeightApp | null>(null);

  const ref = useCallback(
    (div: HTMLDivElement) => {
      if (!div) return;
      const app = new LightWeightApp(div);
      setLightWeightApp(app);
      try {
        const range = selectionToSheetRect(sheets.current, props.a1, sheets.jsA1Context);
        app.reposition(Number(range.min.x), Number(range.min.y), Number(range.max.x), Number(range.max.y));
      } catch {}

      return () => {
        app.destroy();
      };
    },
    [props.a1]
  );

  console.log(lightWeightApp);

  return (
    <div className="border bg-blue-200">
      <div className="bold px-1">{props.a1}</div>
      <div ref={ref} style={{ margin: '4px', width: 'calc(100% - 12px)', height: props.height }} />
    </div>
  );
};
