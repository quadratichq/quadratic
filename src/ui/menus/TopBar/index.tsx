import * as React from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import Container from "@mui/material/Container";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import FileOpen from "@mui/icons-material/FileOpen";
import Save from "@mui/icons-material/Save";
import ContentCopy from "@mui/icons-material/ContentCopy";
import ContentPaste from "@mui/icons-material/ContentPaste";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import NestedMenuItem from "material-ui-nested-menu-item";
import colors from "../../../theme/colors";

export const TopBar = () => {
  const [anchorFileNav, setAnchorFileNav] = React.useState<null | HTMLElement>(
    null
  );

  const handleOpenFileNav = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorFileNav(event.currentTarget);
  };

  const handleCloseFileMenu = () => {
    setAnchorFileNav(null);
  };

  return (
    <AppBar
      position="static"
      style={{
        position: "absolute",
        backgroundColor: "#FFFFFF",
        color: "#212121",
      }}
      elevation={0}
    >
      <Container maxWidth={false}>
        <Toolbar variant="dense" style={{ minHeight: "35px" }} disableGutters>
          {/* <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ mr: 2, display: { xs: "none", md: "flex" } }}
          >
            Quadratic
          </Typography> */}
          <Button style={{ color: "black" }} onClick={handleOpenFileNav}>
            <img src="favicon.ico" height="22px" alt="Quadratic Icon" />
            <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
          </Button>

          <Menu
            sx={{ mt: "27px" }}
            //   PaperProps={{ style: { minWidth: "200px" } }}
            id="menu-appbar"
            anchorEl={anchorFileNav}
            anchorOrigin={{
              vertical: "top",
              horizontal: "left",
            }}
            keepMounted
            transformOrigin={{
              vertical: "top",
              horizontal: "left",
            }}
            open={Boolean(anchorFileNav)}
            onClose={handleCloseFileMenu}
            elevation={1}
          >
            <NestedMenuItem
              label="File"
              parentMenuOpen={Boolean(anchorFileNav)}
            >
              <MenuItem onClick={handleCloseFileMenu}>
                <ListItemIcon>
                  <FileOpen fontSize="small" />
                </ListItemIcon>
                <ListItemText>New Grid</ListItemText>
                <Typography variant="body2" color="text.secondary">
                  ⌘N
                </Typography>
              </MenuItem>
              <MenuItem onClick={handleCloseFileMenu}>
                <ListItemIcon>
                  <Save fontSize="small" />
                </ListItemIcon>
                <ListItemText>Save</ListItemText>
                <Typography variant="body2" color="text.secondary">
                  ⌘S
                </Typography>
              </MenuItem>
            </NestedMenuItem>
            <NestedMenuItem
              label="Edit"
              parentMenuOpen={Boolean(anchorFileNav)}
            >
              <MenuItem>
                <ListItemIcon>
                  <ContentCopy fontSize="small" />
                </ListItemIcon>
                <ListItemText>Copy</ListItemText>
                <Typography variant="body2" color="text.secondary">
                  ⌘C
                </Typography>
              </MenuItem>
              <MenuItem>
                <ListItemIcon>
                  <ContentPaste fontSize="small" />
                </ListItemIcon>
                <ListItemText>Paste</ListItemText>
                <Typography variant="body2" color="text.secondary">
                  ⌘V
                </Typography>
              </MenuItem>
            </NestedMenuItem>
          </Menu>

          {/* <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Open settings">
              <MenuItem onClick={handleOpenUserMenu}>
                <Typography textAlign="center">Edit</Typography>
              </MenuItem>
            </Tooltip>
            <Menu
              sx={{ mt: "27px" }}
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{
                vertical: "top",
                horizontal: "left",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "left",
              }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >

            </Menu>
          </Box> */}
        </Toolbar>
      </Container>
    </AppBar>
  );
};
