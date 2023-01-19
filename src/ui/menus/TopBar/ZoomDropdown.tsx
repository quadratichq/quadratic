import { Button } from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { useRecoilState } from 'recoil';
import { zoomStateAtom } from '../../../atoms/zoomStateAtom';
import { colors } from '../../../theme/colors';
import { focusGrid } from '../../../helpers/focusGrid';
import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import { KeyboardShortcut } from '../KeyboardShortcut';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';

export const ZoomDropdown = () => {
  const [zoomState, setZoomState] = useRecoilState(zoomStateAtom);

  return (
    <Menu
      menuButton={
        <Button style={{ color: colors.darkGray }}>
          {zoomState === Infinity ? 100 : Math.round(zoomState * 100)}%
          <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
        </Button>
      }
    >
      <MenuItem
        onClick={() => {
          setZoomState(Infinity);
          focusGrid();
        }}
      >
        <KeyboardShortcut text="Zoom to fit" shortcut="1" modifier={KeyboardSymbols.Shift} />
      </MenuItem>
      <MenuDivider></MenuDivider>
      <MenuItem
        onClick={() => {
          setZoomState((zoomState) => zoomState * 2);
          focusGrid();
        }}
      >
        <KeyboardShortcut text="Zoom in" shortcut="+" modifier={KeyboardSymbols.Command} />
      </MenuItem>
      <MenuItem
        onClick={() => {
          setZoomState((zoomState) => zoomState * 0.5);
          focusGrid();
        }}
      >
        <KeyboardShortcut text="Zoom out" shortcut="−" modifier={KeyboardSymbols.Command} />
      </MenuItem>
      <MenuDivider></MenuDivider>
      <MenuItem
        onClick={() => {
          setZoomState(0.5);
          focusGrid();
        }}
      >
        Zoom to 50%
      </MenuItem>
      <MenuItem
        onClick={() => {
          setZoomState(1);
          focusGrid();
        }}
      >
        <KeyboardShortcut text="Zoom to 100%" shortcut="0" modifier={KeyboardSymbols.Command} />
      </MenuItem>
      <MenuItem
        onClick={() => {
          setZoomState(2);
          focusGrid();
        }}
      >
        Zoom to 200%
      </MenuItem>
    </Menu>
  );
};
