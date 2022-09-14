import { Button } from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { useRecoilState } from 'recoil';
import { zoomStateAtom } from '../../../atoms/zoomStateAtom';
import { colors } from '../../../theme/colors';
import { focusGrid } from '../../../helpers/focusGrid';
import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';

export const ZoomDropdown = () => {
  const [zoomState, setZoomState] = useRecoilState(zoomStateAtom);

  return (
    <Menu
      menuButton={
        <Button style={{ color: colors.darkGray }}>
          {Math.round(zoomState * 100)}%<KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
        </Button>
      }
    >
      <MenuItem
        onClick={() => {
          setZoomState(Infinity);
          focusGrid();
        }}
      >
        Zoom to Fit
      </MenuItem>
      <MenuDivider></MenuDivider>
      <MenuItem
        onClick={() => {
          setZoomState(zoomState * 2);
          focusGrid();
        }}
      >
        Zoom in
      </MenuItem>
      <MenuItem
        onClick={() => {
          setZoomState(zoomState * 0.5);
          focusGrid();
        }}
      >
        Zoom out
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
        Zoom to 100%
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
