import { Fragment } from "react";
import Button from "@mui/material/Button";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import {
  Menu,
  MenuItem,
  MenuDivider,
  MenuHeader,
  SubMenu,
} from "@szhsin/react-menu";

import {
  FormatBold,
  FormatItalic,
  FormatAlignLeft,
  FormatAlignRight,
  FormatAlignCenter,
  FormatColorText,
  FormatColorFill,
  BorderColor,
  LineStyle,
  BorderAll,
  BorderOuter,
  BorderTop,
  BorderRight,
  BorderLeft,
  BorderBottom,
  BorderInner,
  BorderHorizontal,
  BorderVertical,
} from "@mui/icons-material";
import { PaletteOutlined } from "@mui/icons-material";
import "@szhsin/react-menu/dist/index.css";
import { Tooltip } from "@mui/material";

import colors from "../../../../theme/colors";

const styles = {
  fileMenuIcon: {
    marginRight: "0.5rem",
    color: colors.darkGray,
  },
};

export const FormatMenu = () => {
  return (
    <Menu
      menuButton={
        <Tooltip title="Format" arrow>
          <Button style={{ color: colors.darkGray }}>
            <PaletteOutlined></PaletteOutlined>
            <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
          </Button>
        </Tooltip>
      }
    >
      <MenuHeader>Text</MenuHeader>
      <MenuItem>
        <FormatBold style={styles.fileMenuIcon}></FormatBold> Bold
      </MenuItem>
      <MenuItem>
        <FormatItalic style={styles.fileMenuIcon}></FormatItalic> Italic
      </MenuItem>
      <MenuItem>
        <FormatColorText style={styles.fileMenuIcon}></FormatColorText> Color
      </MenuItem>

      <MenuDivider />
      <MenuItem>
        <FormatAlignLeft style={styles.fileMenuIcon}></FormatAlignLeft> Left
      </MenuItem>
      <MenuItem>
        <FormatAlignCenter style={styles.fileMenuIcon}></FormatAlignCenter>{" "}
        Center
      </MenuItem>
      <MenuItem>
        <FormatAlignRight style={styles.fileMenuIcon}></FormatAlignRight> Right
      </MenuItem>

      <MenuDivider />
      <MenuHeader>Cell</MenuHeader>
      <MenuItem>
        <FormatColorFill style={styles.fileMenuIcon}></FormatColorFill> Fill
        Color
      </MenuItem>

      <SubMenu
        label={
          <Fragment>
            <BorderAll style={styles.fileMenuIcon}></BorderAll>
            <span>Border</span>
          </Fragment>
        }
      >
        <MenuItem>
          <BorderColor style={styles.fileMenuIcon}></BorderColor> Color
        </MenuItem>
        <MenuItem>
          <LineStyle style={styles.fileMenuIcon}></LineStyle>
          Line Style
        </MenuItem>
        <MenuItem>
          <BorderAll style={styles.fileMenuIcon}></BorderAll> All
        </MenuItem>
        <MenuItem>
          <BorderOuter style={styles.fileMenuIcon}></BorderOuter> Outer
        </MenuItem>
        <MenuItem>
          <BorderTop style={styles.fileMenuIcon}></BorderTop> Top
        </MenuItem>
        <MenuItem>
          <BorderLeft style={styles.fileMenuIcon}></BorderLeft> Left
        </MenuItem>
        <MenuItem>
          <BorderRight style={styles.fileMenuIcon}></BorderRight> Right
        </MenuItem>
        <MenuItem>
          <BorderBottom style={styles.fileMenuIcon}></BorderBottom> Bottom
        </MenuItem>
        <MenuItem>
          <BorderInner style={styles.fileMenuIcon}></BorderInner> Inner
        </MenuItem>
        <MenuItem>
          <BorderHorizontal style={styles.fileMenuIcon}></BorderHorizontal>{" "}
          Horizontal
        </MenuItem>
        <MenuItem>
          <BorderVertical style={styles.fileMenuIcon}></BorderVertical> Vertical
        </MenuItem>
      </SubMenu>
    </Menu>
  );
};
