import { CSSProperties } from 'react';
import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, MenuHeader, MenuDivider } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import { Tooltip } from '@mui/material';
import { colors } from '../../../../theme/colors';
import { clearTextFormattingDB, updateTextFormattingDB } from '../../../../core/gridDB/Cells/UpdateTextFormattingDB';
import { useGetSelection } from './useGetSelection';

const numberExStyle = {
  color: colors.darkGray,
  display: 'inline-block',
  fontFamily: 'monospace',
  textAlign: 'right',
  width: '100%',
} as CSSProperties;

export const NumberFormatMenu = () => {
  let userSelection = useGetSelection();

  return (
    <Menu
      menuButton={
        <Tooltip title="Number Format" arrow>
          <Button style={{ color: colors.darkGray }}>
            <span style={{ fontSize: '1rem' }}>123</span>
            <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
          </Button>
        </Tooltip>
      }
      menuStyles={{ minWidth: '18rem' }}
    >
      <MenuHeader>Number Format</MenuHeader>
      <MenuItem type="checkbox" checked={false}>
        Automatic
      </MenuItem>
      <MenuItem
        type="checkbox"
        checked={false}
        onClick={() => {
          clearTextFormattingDB(userSelection);
        }}
      >
        Plain text
      </MenuItem>
      <MenuDivider></MenuDivider>
      <MenuItem
        type="checkbox"
        checked={false}
        onClick={() => {
          updateTextFormattingDB(userSelection, '0,000.00');
        }}
      >
        Number <span style={numberExStyle}>9,999.99</span>
      </MenuItem>
      <MenuItem
        type="checkbox"
        checked={false}
        onClick={() => {
          updateTextFormattingDB(userSelection, '00.00%');
        }}
      >
        Percent <span style={numberExStyle}>99.99%</span>
      </MenuItem>
      {/* <MenuItem type="checkbox" checked={false}>
        Scientific <span style={numberExStyle}>6.02E+23</span>
      </MenuItem> */}
      <MenuDivider></MenuDivider>
      <MenuItem
        type="checkbox"
        checked={false}
        onClick={() => {
          updateTextFormattingDB(userSelection, '$(0,000.00)');
        }}
      >
        Accounting <span style={numberExStyle}>$(9,999.99)</span>
      </MenuItem>
      <MenuItem
        type="checkbox"
        checked={false}
        onClick={() => {
          updateTextFormattingDB(userSelection, '(0,000.00)');
        }}
      >
        Financial <span style={numberExStyle}>(9,999.99)</span>
      </MenuItem>
      <MenuItem
        type="checkbox"
        checked={false}
        onClick={() => {
          updateTextFormattingDB(userSelection, '$0,000.00');
        }}
      >
        Currency <span style={numberExStyle}>$9,999.99</span>
      </MenuItem>
      <MenuDivider></MenuDivider>
      <MenuItem
        type="checkbox"
        checked={false}
        onClick={() => {
          updateTextFormattingDB(userSelection, undefined, 'M/d/yyyy');
        }}
      >
        Date <span style={numberExStyle}>1/1/2022</span>
      </MenuItem>
      {/* <MenuItem type="checkbox" checked={false}>
        Time <span style={numberExStyle}>12:59 PM</span>
      </MenuItem>
      <MenuItem type="checkbox" checked={false}>
        Duration <span style={numberExStyle}>5h 45m 6s</span>
      </MenuItem> */}
      <MenuDivider></MenuDivider>
      <MenuItem
        type="checkbox"
        checked={false}
        onClick={() => {
          clearTextFormattingDB(userSelection);
        }}
      >
        Clear Formatting
      </MenuItem>
    </Menu>
  );
};
