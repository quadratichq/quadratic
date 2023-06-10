import { PointerEvent } from 'react';
import { Sheet } from '../../../grid/sheet/Sheet';

interface Props {
  sheet: Sheet;
  active: boolean;
  onPointerDown: (options: { event: PointerEvent<HTMLDivElement>; sheet: Sheet }) => void;
}

export const SheetBarTab = (props: Props): JSX.Element => {
  const { sheet, active, onPointerDown } = props;
  return (
    <div
      className="sheet-tab"
      data-order={sheet.order * 2}
      data-id={sheet.id}
      style={{
        textAlign: 'center',
        padding: '0.5rem 1rem',
        background: active ? 'white' : '',
        opacity: active ? 1 : 0.5,
        cursor: 'pointer',
        transition: 'box-shadow 200ms ease',

        // * 2 is needed so there's a space next to each tab
        order: sheet.order * 2,
      }}
      onPointerDown={(event) => onPointerDown({ event, sheet })}
    >
      {sheet.name}
    </div>
  );
};
