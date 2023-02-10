import { Button } from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { useRecoilState } from 'recoil';
import { zoomStateAtom } from '../../../atoms/zoomStateAtom';
import { colors } from '../../../theme/colors';
import { focusGrid } from '../../../helpers/focusGrid';
import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import { MenuLineItem } from './MenuLineItem';
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
          setZoomState((zoomState) => zoomState * 2);
          focusGrid();
        }}
      >
        <MenuLineItem primary="Zoom in" secondary={KeyboardSymbols.Command + '+'} />
      </MenuItem>
      <MenuItem
        onClick={() => {
          setZoomState((zoomState) => zoomState * 0.5);
          focusGrid();
        }}
      >
        <MenuLineItem primary="Zoom out" secondary={KeyboardSymbols.Command + '−'} />
      </MenuItem>
      <MenuDivider></MenuDivider>
      <MenuItem
        onClick={() => {
          setZoomState(Infinity);
          focusGrid();
        }}
      >
        <MenuLineItem primary="Zoom to fit" secondary={KeyboardSymbols.Command + '9'} />
      </MenuItem>
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
        <MenuLineItem primary="Zoom to 100%" secondary={KeyboardSymbols.Command + '0'} />
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
