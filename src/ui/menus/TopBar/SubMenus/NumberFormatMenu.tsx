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
import { DecimalDecrease, DecimalIncrease, Icon123 } from '../../../icons';
import { topBarIconStyles } from './menuStyles';

const numberExStyle = {
  color: colors.darkGray,
  display: 'inline-block',
  fontFamily: 'monospace',
  textAlign: 'right',
  paddingTop: '0.4rem',
  height: '2rem',
} as CSSProperties;

const menuItemStyle = { justifyContent: 'space-between' } as CSSProperties;

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
            <Icon123 style={{ ...topBarIconStyles, width: 36, height: 36 }}></Icon123>
            <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
          </Button>
        </Tooltip>
      }
      menuStyles={{ minWidth: '18rem' }}
    >
      <MenuItem styles={menuItemStyle}>
        Plain text <span style={numberExStyle}>Abc</span>
      </MenuItem>
      <MenuItem
        styles={menuItemStyle}
        onClick={() => {
          textFormatIncreaseDecimalPlaces();
        }}
      >
        Increase Decimals{' '}
        <span style={numberExStyle}>
          <DecimalIncrease />
        </span>
      </MenuItem>
      <MenuItem
        styles={menuItemStyle}
        onClick={() => {
          textFormatDecreaseDecimalPlaces();
        }}
      >
        Decrease Decimals{' '}
        <span style={numberExStyle}>
          <DecimalDecrease />
        </span>
      </MenuItem>
      <MenuItem styles={menuItemStyle} onClick={() => textFormatSetNumber()}>
        Number <span style={numberExStyle}>9,999.99</span>
      </MenuItem>
      <MenuItem styles={menuItemStyle} onClick={() => textFormatSetCurrency()}>
        Currency <span style={numberExStyle}>$9,999.99</span>
      </MenuItem>
      <MenuItem styles={menuItemStyle} onClick={() => textFormatSetPercentage()}>
        Percent <span style={numberExStyle}>99.99%</span>
      </MenuItem>
      <MenuItem styles={menuItemStyle} onClick={() => textFormatSetExponential()}>
        Scientific <span style={numberExStyle}>6.02E+23</span>
      </MenuItem>
    </Menu>
  );
};
