import Button from "@mui/material/Button";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import {
  Menu,
  MenuItem,
  SubMenu,
  MenuDivider,
  MenuHeader,
} from "@szhsin/react-menu";
import FileOpenOutlined from "@mui/icons-material/FileOpenOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import "@szhsin/react-menu/dist/index.css";
import useLocalStorage from "../../../../hooks/useLocalStorage";
import { Tooltip } from "@mui/material";

import { SaveGridFile } from "../../../../core/actions/gridFile/SaveGridFile";
import { OpenGridFile } from "../../../../core/actions/gridFile/OpenGridFile";

const styles = {
  fileMenuIcon: {
    marginRight: "0.5rem",
  },
};

export const QuadraticMenu = () => {
  const [showDebugMenu, setShowDebugMenu] = useLocalStorage(
    "showDebugMenu",
    false
  );
  const [showGridAxes, setShowGridAxes] = useLocalStorage("showGridAxes", true);

  return (
    <Menu
      menuButton={
        <Tooltip title="Main Menu" arrow>
          <Button style={{ color: "black" }}>
            <img src="favicon.ico" height="22px" alt="Quadratic Icon" />
            <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
          </Button>
        </Tooltip>
      }
    >
      <SubMenu label="File">
        <MenuItem onClick={() => SaveGridFile(true)}>
          <SaveOutlined style={styles.fileMenuIcon}></SaveOutlined> Save Grid
        </MenuItem>
        <MenuItem onClick={() => OpenGridFile()}>
          <FileOpenOutlined style={styles.fileMenuIcon}></FileOpenOutlined> Open
          Grid
        </MenuItem>
      </SubMenu>
      <SubMenu label="View">
        <MenuHeader>Grid</MenuHeader>
        <MenuItem
          type="checkbox"
          checked={showGridAxes}
          onClick={() => setShowGridAxes(!showGridAxes)}
        >
          Show Axis
        </MenuItem>
        <MenuDivider />
        <MenuHeader>Debug</MenuHeader>
        <MenuItem
          type="checkbox"
          checked={showDebugMenu}
          onClick={() => {
            setShowDebugMenu(!showDebugMenu);
          }}
        >
          Show DebugMenu
        </MenuItem>
      </SubMenu>
    </Menu>
  );
};
