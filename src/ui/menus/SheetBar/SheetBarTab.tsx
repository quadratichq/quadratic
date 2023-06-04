import { PointerEvent } from 'react';
import { Sheet } from '../../../grid/sheet/Sheet';

interface Props {
  sheet: Sheet;
  index: number;
  active: boolean;
  onPointerDown: (options: { event: PointerEvent<HTMLDivElement>; sheet: Sheet; index: number }) => void;
}

export const SheetBarTab = (props: Props): JSX.Element => {
  const { sheet, index, active, onPointerDown } = props;
  return (
    <div
      className="sheet-tab"
      data-order={sheet.order}
      style={{
        textAlign: 'center',
        padding: '0.5rem 1rem',
        background: active ? 'white' : '',
        opacity: active ? 1 : 0.5,
        cursor: 'pointer',
      }}
      onPointerDown={(event) => onPointerDown({ event, sheet, index })}
    >
      {sheet.name}
    </div>
  );
};
