import { events } from '@/app/events/events';
import { Typography } from '@mui/material';
import { Menu, MenuChangeEvent, MenuDivider, MenuItem } from '@szhsin/react-menu';
import mixpanel from 'mixpanel-browser';
import { useCallback, useEffect, useState } from 'react';
import { zoomInOut, zoomToFit, zoomToSelection } from '../../../gridGL/helpers/zoom';
import { focusGrid } from '../../../helpers/focusGrid';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { MenuLineItem } from './MenuLineItem';
import { TopBarMenuItem } from './TopBarMenuItem';

export const TopBarZoomMenu = () => {
  const [zoom, setZoom] = useState(1);
  const handleZoom = useCallback((scale: number) => setZoom(scale), [setZoom]);

  useEffect(() => {
    events.on('zoom', handleZoom);
    return () => {
      events.off('zoom', handleZoom);
    };
  }, [handleZoom]);

  const setZoomState = useCallback((value: number) => {
    zoomInOut(value);
    focusGrid();
  }, []);

  // focus canvas after the zoom menu closes
  const onMenuChange = useCallback((event: MenuChangeEvent) => {
    if (!event.open) focusGrid();
  }, []);

  return (
    <Menu
      onMenuChange={onMenuChange}
      menuButton={({ open }) => (
        <TopBarMenuItem title="Zoom options" open={open} className="w-[70px] self-stretch">
          <Typography variant="subtitle2" color="inherit" fontSize=".8125rem">
            {zoom === Infinity ? 100 : Math.round(zoom * 100)}%
          </Typography>
        </TopBarMenuItem>
      )}
    >
      <MenuItem
        onClick={() => {
          mixpanel.track('[ZoomDropdown].zoomIn');
          setZoomState(zoom * 2);
        }}
      >
        <MenuLineItem primary="Zoom in" secondary={KeyboardSymbols.Command + '+'} />
      </MenuItem>
      <MenuItem
        onClick={() => {
          mixpanel.track('[ZoomDropdown].zoomOut');
          setZoomState(zoom * 0.5);
        }}
      >
        <MenuLineItem primary="Zoom out" secondary={KeyboardSymbols.Command + '−'} />
      </MenuItem>
      <MenuDivider></MenuDivider>
      <MenuItem
        onClick={() => {
          mixpanel.track('[ZoomDropdown].zoomToSelection');
          zoomToSelection();
        }}
      >
        <MenuLineItem primary="Zoom to selection" secondary={KeyboardSymbols.Command + '8'} />
      </MenuItem>
      <MenuItem
        onClick={() => {
          mixpanel.track('[ZoomDropdown].zoomToFit');
          zoomToFit();
        }}
      >
        <MenuLineItem primary="Zoom to fit" secondary={KeyboardSymbols.Command + '9'} />
      </MenuItem>
      <MenuItem
        onClick={() => {
          mixpanel.track('[ZoomDropdown].zoom50%');
          setZoomState(0.5);
        }}
      >
        <MenuLineItem primary="Zoom to 50%" />
      </MenuItem>
      <MenuItem
        onClick={() => {
          mixpanel.track('[ZoomDropdown].zoom100%');
          setZoomState(1);
        }}
      >
        <MenuLineItem primary="Zoom to 100%" secondary={KeyboardSymbols.Command + '0'} />
      </MenuItem>
      <MenuItem
        onClick={() => {
          mixpanel.track('[ZoomDropdown].zoom200%');
          setZoomState(2);
        }}
      >
        <MenuLineItem primary="Zoom to 200%" />
      </MenuItem>
    </Menu>
  );
};
