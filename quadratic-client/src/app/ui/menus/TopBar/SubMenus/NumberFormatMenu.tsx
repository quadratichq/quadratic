import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';

import '@szhsin/react-menu/dist/index.css';
import { MenuLineItem } from '../MenuLineItem';
import {
  removeCellNumericFormat,
  setCellCommas,
  textFormatDecreaseDecimalPlaces,
  textFormatIncreaseDecimalPlaces,
  textFormatSetCurrency,
  textFormatSetExponential,
  textFormatSetPercentage,
} from './formatCells';

import {
  DecimalDecreaseIcon,
  DecimalIncreaseIcon,
  DollarIcon,
  FunctionIcon,
  Icon123,
  MagicWandIcon,
  PercentIcon,
  QuoteIcon,
} from '@/app/ui/icons';
import '@szhsin/react-menu/dist/index.css';
import { TopBarMenuItem } from '../TopBarMenuItem';

export const NumberFormatMenu = () => {
  return (
    <Menu
      menuButton={({ open }) => (
        <TopBarMenuItem title="Number format" open={open}>
          <Icon123 style={{ fontSize: '1.8125rem' }} />
        </TopBarMenuItem>
      )}
    >
      <MenuItem onClick={() => removeCellNumericFormat()}>
        <MenuLineItem primary="Automatic" secondary={<code className="text-xs">999.99</code>} icon={MagicWandIcon} />
      </MenuItem>
      <MenuItem onClick={() => textFormatSetCurrency()}>
        <MenuLineItem primary="Currency" secondary={<code className="text-xs">$9,999.99</code>} icon={DollarIcon} />
      </MenuItem>
      <MenuItem onClick={() => textFormatSetPercentage()}>
        <MenuLineItem primary="Percent" secondary={<code className="text-xs">99.99%</code>} icon={PercentIcon} />
      </MenuItem>
      <MenuItem onClick={() => textFormatSetExponential()}>
        <MenuLineItem primary="Scientific" secondary={<code className="text-xs">6.02E+23</code>} icon={FunctionIcon} />
      </MenuItem>
      <MenuItem onClick={() => setCellCommas()}>
        <MenuLineItem primary="Toggle commas" secondary={<code className="text-xs">9,999.99</code>} icon={QuoteIcon} />
      </MenuItem>

      <MenuDivider />

      <MenuItem
        onClick={() => {
          textFormatIncreaseDecimalPlaces();
        }}
      >
        <MenuLineItem
          primary="Increase decimals"
          secondary={<code className="text-xs">.0000</code>}
          icon={DecimalIncreaseIcon}
        />
      </MenuItem>
      <MenuItem
        onClick={() => {
          textFormatDecreaseDecimalPlaces();
        }}
      >
        <MenuLineItem
          primary="Decrease decimals"
          secondary={<code className="text-xs">.0</code>}
          icon={DecimalDecreaseIcon}
        />
      </MenuItem>
    </Menu>
  );
};
