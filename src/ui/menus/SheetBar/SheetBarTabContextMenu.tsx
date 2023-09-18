import { ControlledMenu, MenuDivider, MenuItem, SubMenu } from '@szhsin/react-menu';
import { useState } from 'react';
import { ColorResult } from 'react-color';
import { sheets } from '../../../grid/controller/Sheets';
import { convertReactColorToString } from '../../../helpers/convertColor';
import { focusGrid } from '../../../helpers/focusGrid';
import { QColorPicker } from '../../components/qColorPicker';
import { ConfirmDeleteSheet } from './ConfirmDeleteSheet';

interface Props {
  contextMenu?: { x: number; y: number; id: string; name: string };
  handleRename: () => void;
  handleClose: () => void;
}

export const SheetBarTabContextMenu = (props: Props): JSX.Element => {
  const { contextMenu, handleClose, handleRename } = props;
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
        <MenuItem onClick={handleRename}>Rename</MenuItem>
        <MenuItem
          onClick={handleClose}
          onClickCapture={() => {
            sheets.duplicate();
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
        <SubMenu label="Change color" className="color-picker-submenu">
          <QColorPicker
            onChangeComplete={(change: ColorResult) => {
              const color = convertReactColorToString(change);
              if (contextMenu) {
                sheets.sheet.color = color;
                focusGrid();
              }
              handleClose();
            }}
            onClear={() => {
              if (contextMenu) {
                sheets.sheet.color = undefined;
                focusGrid();
              }
              handleClose();
            }}
          />
        </SubMenu>
        <MenuDivider />
        <MenuItem
          disabled={sheets.getFirst().id === contextMenu?.id}
          onClick={() => {
            if (contextMenu) {
              sheets.moveSheet({ id: sheets.sheet.id, delta: -1 });
              focusGrid();
            }
            handleClose();
          }}
        >
          Move left
        </MenuItem>
        <MenuItem
          disabled={sheets.getLast().id === contextMenu?.id}
          onClick={() => {
            if (contextMenu) {
              sheets.moveSheet({ id: sheets.sheet.id, delta: 1 });
              focusGrid();
            }
            handleClose();
          }}
        >
          Move right
        </MenuItem>
      </ControlledMenu>
      <ConfirmDeleteSheet
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
