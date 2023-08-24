import { ControlledMenu, MenuDivider, MenuItem, SubMenu } from '@szhsin/react-menu';
import { useState } from 'react';
import { ColorResult } from 'react-color';
import { SheetController } from '../../../grid/controller/SheetController';
import { convertReactColorToString } from '../../../helpers/convertColor';
import { focusGrid } from '../../../helpers/focusGrid';
import { QColorPicker } from '../../components/qColorPicker';
import { ConfirmDeleteSheet } from './ConfirmDeleteSheet';

interface Props {
  sheetController: SheetController;
  contextMenu?: { x: number; y: number; id: string; name: string };
  handleRename: () => void;
  handleClose: () => void;
}

export const SheetBarTabContextMenu = (props: Props): JSX.Element => {
  const { sheetController, contextMenu, handleClose, handleRename } = props;
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | undefined>();
  const [lastName, setLastName] = useState<string | undefined>();

  return (
    <>
      <ControlledMenu
        className="sheet-bar-context-menu"
        state={!!contextMenu ? 'open' : 'closed'}
        onClose={handleClose}
        anchorPoint={contextMenu ? { x: contextMenu?.x, y: contextMenu?.y } : undefined}
      >
        <MenuItem onClick={handleRename}>
          <b>Rename</b>
        </MenuItem>
        <MenuItem
          onClick={handleClose}
          onClickCapture={() => {
            sheetController.sheets.duplicate();
            focusGrid();
          }}
        >
          Duplicate
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!contextMenu) return;
            setConfirmDelete({ ...contextMenu });
            setLastName(confirmDelete?.name);
            handleClose();
          }}
        >
          Delete
        </MenuItem>
        <SubMenu label="Change Color">
          <QColorPicker
            onChangeComplete={(change: ColorResult) => {
              const color = convertReactColorToString(change);
              if (contextMenu) {
                sheetController.sheet.color = color;
                focusGrid();
              }
              handleClose();
            }}
            onClear={() => {
              if (contextMenu) {
                sheetController.sheet.color = undefined;
                focusGrid();
              }
              handleClose();
            }}
          />
        </SubMenu>
        <MenuDivider />
        <MenuItem
          disabled={sheetController.sheets.getFirst().id === contextMenu?.id}
          onClick={() => {
            if (contextMenu) {
              sheetController.sheets.moveSheet({ id: sheetController.sheet.id, delta: -1 });
              focusGrid();
            }
            handleClose();
          }}
        >
          Move Left
        </MenuItem>
        <MenuItem
          disabled={sheetController.sheets.getLast().id === contextMenu?.id}
          onClick={() => {
            if (contextMenu) {
              sheetController.sheets.moveSheet({ id: sheetController.sheet.id, delta: 1 });
              focusGrid();
            }
            handleClose();
          }}
        >
          Move Right
        </MenuItem>
      </ControlledMenu>
      <ConfirmDeleteSheet
        sheetController={sheetController}
        lastName={lastName}
        confirmDelete={confirmDelete}
        handleClose={() => {
          setConfirmDelete(undefined);
          window.setTimeout(focusGrid, 0);
        }}
      />
    </>
  );
};
