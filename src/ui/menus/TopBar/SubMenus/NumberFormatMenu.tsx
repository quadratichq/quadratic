import { CSSProperties } from 'react';
import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, MenuHeader, MenuDivider } from '@szhsin/react-menu';

import '@szhsin/react-menu/dist/index.css';
import { Tooltip } from '@mui/material';

import { colors } from '../../../../theme/colors';
import { useFormatCells } from './useFormatCells';
import { PixiApp } from '../../../../core/gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../../core/transaction/sheetController';

const numberExStyle = {
  color: colors.darkGray,
  display: 'inline-block',
  fontFamily: 'monospace',
  textAlign: 'right',
  width: '100%',
} as CSSProperties;

interface IProps {
  app: PixiApp;
  sheet_controller: SheetController;
}

export const NumberFormatMenu = (props: IProps) => {
  const {
    textFormatIncreaseDecimalPlaces,
    textFormatDecreaseDecimalPlaces,
    textFormatSetCurrency,
    textFormatSetPercentage,
    textFormatSetNumber,
    textFormatSetExponential,
  } = useFormatCells(props.sheet_controller, props.app);

  return (
    <Menu
      menuButton={
        <Tooltip title="Number format" arrow disableInteractive enterDelay={500} enterNextDelay={500}>
          <Button style={{ color: colors.darkGray }}>
            <span style={{ fontSize: '1rem' }}>123</span>
            <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
          </Button>
        </Tooltip>
      }
      menuStyles={{ minWidth: '18rem' }}
    >
      <MenuHeader>Coming soon</MenuHeader>
      <MenuDivider></MenuDivider>
      <MenuHeader>Number format</MenuHeader>
      <MenuItem disabled type="checkbox" checked={true}>
        Automatic
      </MenuItem>
      <MenuItem disabled type="checkbox" checked={false}>
        Plain text
      </MenuItem>
      <MenuDivider></MenuDivider>
      <MenuItem
        onClick={() => {
          textFormatIncreaseDecimalPlaces();
        }}
      >
        Increase Decimals <span style={numberExStyle}>9.99+</span>
      </MenuItem>
      <MenuItem
        onClick={() => {
          textFormatDecreaseDecimalPlaces();
        }}
      >
        Decrease Decimals <span style={numberExStyle}>9.99-</span>
      </MenuItem>
      <MenuDivider></MenuDivider>
      <MenuItem type="checkbox" checked={false} onClick={() => textFormatSetNumber()}>
        Number <span style={numberExStyle}>9,999.99</span>
      </MenuItem>
      <MenuItem type="checkbox" checked={false} onClick={() => textFormatSetPercentage()}>
        Percent <span style={numberExStyle}>99.99%</span>
      </MenuItem>
      <MenuItem type="checkbox" checked={false} onClick={() => textFormatSetExponential()}>
        Scientific <span style={numberExStyle}>6.02E+23</span>
      </MenuItem>
      <MenuDivider></MenuDivider>
      <MenuItem disabled type="checkbox" checked={false}>
        Accounting <span style={numberExStyle}>$(9,999.99)</span>
      </MenuItem>
      <MenuItem disabled type="checkbox" checked={false}>
        Financial <span style={numberExStyle}>(9,999.99)</span>
      </MenuItem>
      <MenuItem type="checkbox" checked={false} onClick={() => textFormatSetCurrency()}>
        Currency <span style={numberExStyle}>$9,999.99</span>
      </MenuItem>
      <MenuDivider></MenuDivider>
      <MenuItem disabled type="checkbox" checked={false}>
        Date <span style={numberExStyle}>1/1/2022</span>
      </MenuItem>
      <MenuItem disabled type="checkbox" checked={false}>
        Time <span style={numberExStyle}>12:59 PM</span>
      </MenuItem>
      {/* <MenuItem disabled type="checkbox" checked={false}>
        Datetime <span style={numberExStyle}>01/01/2022 12:59 PM</span>
      </MenuItem> */}
      <MenuItem disabled type="checkbox" checked={false}>
        Duration <span style={numberExStyle}>5h 45m 6s</span>
      </MenuItem>
      <MenuDivider></MenuDivider>
      <MenuItem disabled type="checkbox" checked={false}>
        Custom
      </MenuItem>
    </Menu>
  );
};
