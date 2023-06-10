/* eslint-disable @typescript-eslint/no-unused-vars */
import { PointerEvent, useCallback, useState } from 'react';
import { Sheet } from '../../../grid/sheet/Sheet';
import { useLocalFiles } from '../../contexts/LocalFiles';
import { SheetController } from '../../../grid/controller/sheetController';
import { Input } from '@mui/material';

interface Props {
  sheet: Sheet;
  sheetController: SheetController;
  active: boolean;
  onPointerDown: (options: { event: PointerEvent<HTMLDivElement>; sheet: Sheet }) => void;
}

export const SheetBarTab = (props: Props): JSX.Element => {
  const { sheet, sheetController, active, onPointerDown } = props;

  const localFiles = useLocalFiles();
  const [isRenaming, setIsRenaming] = useState(false);

  const onRenameSheet = useCallback(
    (name?: string) => {
      if (name) {
        sheetController.sheet.rename(name);
        localFiles.save();
      }
      setIsRenaming(false);
    },
    [localFiles, sheetController.sheet]
  );

  if (isRenaming) {
    return (
      <input
        className="sheet-tab"
        data-order={sheet.order * 2}
        data-id={sheet.id}
        autoFocus={true}
        style={{
          textAlign: 'left',
          padding: '0.5rem 1rem',
          height: '100%',
          background: 'white',
          fontSize: '0.7rem',
          border: 'none',

          // * 2 is needed so there's a space next to each tab
          order: sheet.order * 2,
        }}
        onPointerDown={(event) => onPointerDown({ event, sheet })}
        onDoubleClick={() => setIsRenaming(true)}
        onBlur={(event) => {
          setIsRenaming(false);
          const input = event.currentTarget as HTMLInputElement;
          if (input.value !== sheet.name) {
            sheetController.sheet.rename(input.value);
            localFiles.save();
          }
        }}
        value={sheet.name}
      />
    );
  }

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
      onDoubleClick={(event) => {
        setIsRenaming(true);
        window.setTimeout(() => event.currentTarget.focus(), 0);
      }}
      onBlur={() => {
        setIsRenaming(false);
        console.log('blur');
      }}
    >
      {sheet.name}
    </div>
  );
};
