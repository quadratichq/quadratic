import { Button } from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { colors } from '../../../theme/colors';
import { focusGrid } from '../../../helpers/focusGrid';
import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import { MenuLineItem } from './MenuLineItem';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { useCallback, useState } from 'react';
import useEventListener from '../../../hooks/useEventListener';

interface Props {
  app: PixiApp;
}

export const ZoomDropdown = (props: Props) => {
  const [zoom, setZoom] = useState(1);
  const handleZoom = useCallback(
    (event: CustomEvent<number>) => {
      setZoom(event.detail);
    },
    [setZoom]
  );
  useEventListener('zoom-event', handleZoom);

  const setZoomState = useCallback(
    (value: number) => {
      props.app.setZoomState(value);
      focusGrid();
    },
    [props.app]
  );

  return (
    <Menu
      menuButton={
        <Button style={{ color: colors.darkGray, width: '4rem' }}>
          {zoom === Infinity ? 100 : Math.round(zoom * 100)}%<KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
        </Button>
      }
    >
      <MenuItem onClick={() => setZoomState(zoom * 2)}>
        <MenuLineItem primary="Zoom in" secondary={KeyboardSymbols.Command + '+'} />
      </MenuItem>
      <MenuItem onClick={() => setZoomState(zoom * 0.5)}>
        <MenuLineItem primary="Zoom out" secondary={KeyboardSymbols.Command + '−'} />
      </MenuItem>
      <MenuDivider></MenuDivider>
      <MenuItem onClick={() => props.app.setZoomToFit()}>
        <MenuLineItem primary="Zoom to fit" secondary={KeyboardSymbols.Command + '9'} />
      </MenuItem>
      <MenuItem onClick={() => setZoomState(0.5)}>Zoom to 50%</MenuItem>
      <MenuItem onClick={() => setZoomState(1)}>
        <MenuLineItem primary="Zoom to 100%" secondary={KeyboardSymbols.Command + '0'} />
      </MenuItem>
      <MenuItem onClick={() => setZoomState(2)}>Zoom to 200%</MenuItem>
    </Menu>
  );
};
