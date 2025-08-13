import { LightWeightApp } from '@/app/gridGL/lightweightApp/LightWeightApp';
import { useEffect, useRef, useState } from 'react';

interface Props {
  first: boolean;
  height: number;
}

export const AILightWeight = (props: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  const [lightWeightApp, setLightWeightApp] = useState<LightWeightApp | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const lightWeightApp = new LightWeightApp(ref.current, props.first);
    setLightWeightApp(lightWeightApp);

    return () => {
      lightWeightApp.destroy();
    };
  }, [props.first]);

  console.log(ref.current);
  console.log(lightWeightApp);

  return (
    <div ref={ref} className="border" style={{ margin: '4px', width: 'calc(100% - 12px)', height: props.height }}></div>
  );
};
