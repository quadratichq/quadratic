import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, MenuDivider } from '@szhsin/react-menu';

import '@szhsin/react-menu/dist/index.css';
import { Tooltip } from '@mui/material';
import { useFormatCells } from './useFormatCells';
import { PixiApp } from '../../../../gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../../grid/controller/sheetController';
import { DecimalDecrease, DecimalIncrease, Icon123 } from '../../../icons';
import { AbcOutlined, AttachMoney, Functions, Percent } from '@mui/icons-material';
import { MenuLineItem } from '../MenuLineItem';

interface IProps {
  app: PixiApp;
  sheet_controller: SheetController;
}

export const NumberFormatMenu = (props: IProps) => {
  const {
    textFormatIncreaseDecimalPlaces,
    textFormatDecreaseDecimalPlaces,
    textFormatClear,
    textFormatSetCurrency,
    textFormatSetPercentage,
    textFormatSetNumber,
    textFormatSetExponential,
  } = useFormatCells(props.sheet_controller, props.app);

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
