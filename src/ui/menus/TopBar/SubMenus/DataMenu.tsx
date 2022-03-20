import Button from "@mui/material/Button";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import { Menu, MenuItem, MenuHeader } from "@szhsin/react-menu";

import {
  CloudDownloadOutlined,
  StorageOutlined,
  DataObjectOutlined,
} from "@mui/icons-material";

import "@szhsin/react-menu/dist/index.css";
import { Tooltip } from "@mui/material";

import colors from "../../../../theme/colors";

const styles = {
  fileMenuIcon: {
    marginRight: "0.5rem",
    color: colors.darkGray,
  },
};

export const DataMenu = () => {
  return (
    <Menu
      menuButton={
        <Tooltip title="Data" arrow>
          <Button style={{ color: colors.darkGray }}>
            <DataObjectOutlined></DataObjectOutlined>
            <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
          </Button>
        </Tooltip>
      }
    >
      <MenuHeader>Import</MenuHeader>
      <MenuItem>
        <CloudDownloadOutlined
          style={styles.fileMenuIcon}
        ></CloudDownloadOutlined>
        SaaS
      </MenuItem>
      <MenuItem>
        <StorageOutlined style={styles.fileMenuIcon}></StorageOutlined> Database
      </MenuItem>
    </Menu>
  );
};
