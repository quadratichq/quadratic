import { CSSProperties } from 'react';
import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, MenuHeader, MenuDivider } from '@szhsin/react-menu';

import '@szhsin/react-menu/dist/index.css';
import { Tooltip } from '@mui/material';

import { colors } from '../../../../theme/colors';

const numberExStyle = {
  color: colors.darkGray,
  display: 'inline-block',
  fontFamily: 'monospace',
  textAlign: 'right',
  width: '100%',
} as CSSProperties;

export const NumberFormatMenu = () => {
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
      <MenuItem disabled type="checkbox" checked={false}>
        Number <span style={numberExStyle}>9,999.99</span>
      </MenuItem>
      <MenuItem disabled type="checkbox" checked={false}>
        Percent <span style={numberExStyle}>99.99%</span>
      </MenuItem>
      <MenuItem disabled type="checkbox" checked={false}>
        Scientific <span style={numberExStyle}>6.02E+23</span>
      </MenuItem>
      <MenuDivider></MenuDivider>
      <MenuItem disabled type="checkbox" checked={false}>
        Accounting <span style={numberExStyle}>$(9,999.99)</span>
      </MenuItem>
      <MenuItem disabled type="checkbox" checked={false}>
        Financial <span style={numberExStyle}>(9,999.99)</span>
      </MenuItem>
      <MenuItem disabled type="checkbox" checked={false}>
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
