import { Menu, MenuDivider, MenuInstance, MenuItem, SubMenu } from '@szhsin/react-menu';
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

import { focusGrid } from '@/app/helpers/focusGrid';
import { DateFormat } from '@/app/ui/components/DateFormat';
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
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import '@szhsin/react-menu/dist/index.css';
import { useRef, useState } from 'react';
import { TopBarMenuItem } from '../TopBarMenuItem';

export const NumberFormatMenu = () => {
  const menuRef = useRef<MenuInstance | null>(null);
  const [openDateFormatMenu, setOpenDateFormatMenu] = useState(false);

  const closeMenu = () => {
    menuRef.current?.closeMenu();
    focusGrid();
  };

  return (
    <Menu
      instanceRef={menuRef}
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

      <MenuDivider />

      <SubMenu
        label={
          <MenuLineItem
            primary="Date and time format"
            secondary={`3/4/${new Date().getFullYear()}`}
            icon={CalendarMonthIcon}
          ></MenuLineItem>
        }
        onMenuChange={(e) => setOpenDateFormatMenu(e.open)}
      >
        <DateFormat status={openDateFormatMenu} closeMenu={closeMenu} className="block min-w-80 px-4 py-2" />
      </SubMenu>
    </Menu>
  );
};
