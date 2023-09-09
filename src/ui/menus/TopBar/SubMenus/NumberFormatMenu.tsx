import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import Button from '@mui/material/Button';
import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';

import { AbcOutlined, AttachMoney, Functions, Percent } from '@mui/icons-material';
import { Tooltip } from '@mui/material';
import '@szhsin/react-menu/dist/index.css';
import { DecimalDecrease, DecimalIncrease, Icon123 } from '../../../icons';
import { MenuLineItem } from '../MenuLineItem';
import {
  textFormatClear,
  textFormatDecreaseDecimalPlaces,
  textFormatIncreaseDecimalPlaces,
  textFormatSetCurrency,
  textFormatSetExponential,
  textFormatSetNumber,
  textFormatSetPercentage,
} from './formatCells';

export const NumberFormatMenu = () => {
  return (
    <Menu
      menuButton={
        <Tooltip title="Number format" arrow disableInteractive enterDelay={500} enterNextDelay={500}>
          <Button style={{ color: 'inherit' }}>
            <Icon123 style={{ fontSize: '1.8125rem' }} />
            <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
          </Button>
        </Tooltip>
      }
    >
      <MenuItem onClick={() => textFormatClear()}>
        <MenuLineItem primary="Plain text" secondary={<code>Abc</code>} Icon={AbcOutlined} />
      </MenuItem>
      <MenuItem onClick={() => textFormatSetNumber()}>
        <MenuLineItem primary="Number" secondary={<code>9,999.99</code>} Icon={Icon123} />
      </MenuItem>
      <MenuItem onClick={() => textFormatSetCurrency()}>
        <MenuLineItem primary="Currency" secondary={<code>$9,999.99</code>} Icon={AttachMoney} />
      </MenuItem>
      <MenuItem onClick={() => textFormatSetPercentage()}>
        <MenuLineItem primary="Percent" secondary={<code>99.99%</code>} Icon={Percent} />
      </MenuItem>
      <MenuItem onClick={() => textFormatSetExponential()}>
        <MenuLineItem primary="Scientific" secondary={<code>6.02E+23</code>} Icon={Functions} />
      </MenuItem>

      <MenuDivider />

      <MenuItem
        onClick={() => {
          textFormatIncreaseDecimalPlaces();
        }}
      >
        <MenuLineItem primary="Increase decimals" Icon={DecimalIncrease} />
      </MenuItem>
      <MenuItem
        onClick={() => {
          textFormatDecreaseDecimalPlaces();
        }}
      >
        <MenuLineItem primary="Decrease decimals" Icon={DecimalDecrease} />
      </MenuItem>
    </Menu>
  );
};
