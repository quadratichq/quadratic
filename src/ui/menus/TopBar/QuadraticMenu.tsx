import Button from "@mui/material/Button";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import {
  Menu,
  MenuItem,
  SubMenu,
  MenuDivider,
  MenuHeader,
} from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";

export const QuadraticMenu = () => {
  return (
    <Menu
      menuButton={
        <Button style={{ color: "black" }}>
          <img src="favicon.ico" height="22px" alt="Quadratic Icon" />
          <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
        </Button>
      }
    >
      <SubMenu label="File">
        <MenuItem>Save Grid</MenuItem>
        <MenuItem>Open Grid</MenuItem>
      </SubMenu>
      <SubMenu label="View">
        <MenuHeader>Grid</MenuHeader>
        <MenuItem>Show Axis</MenuItem>
        <MenuDivider />
        <MenuHeader>Debug</MenuHeader>
        <MenuItem>Show DebugTerminal</MenuItem>
        <MenuItem>Prove WebGL</MenuItem>
      </SubMenu>
    </Menu>
  );
};
