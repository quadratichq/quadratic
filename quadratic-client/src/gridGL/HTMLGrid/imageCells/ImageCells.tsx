import {
  useCallback,
  useEffect,
  useState
} from 'react';
import './ImageCells.css';
import {imageCellsHandler} from './ImageCellsHandler';

export const ImageCells = () => {
  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const divRef = useCallback((node: HTMLDivElement) => {
    setDiv(node);
    imageCellsHandler.attach(node);
  }, []);

  useEffect(() => {
    imageCellsHandler.init(div);
    return () => imageCellsHandler.destroy();
  }, [div]);

  return (
    <div
      ref={divRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
      }}
    />
  );
};
