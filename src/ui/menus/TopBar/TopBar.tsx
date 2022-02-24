import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Container from "@mui/material/Container";

import { QuadraticMenu } from "./QuadraticMenu";

import { isElectron } from "../../../utils/isElectron";

export const TopBar = () => {
  return (
    <AppBar
      position="static"
      style={{
        position: "absolute",
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        color: "#212121",
        //@ts-expect-error
        WebkitAppRegion: "drag", // this allows the window to be dragged in Electron
        paddingLeft: isElectron() ? "50px" : "0px",
        backdropFilter: "blur(1px)",
      }}
      elevation={0}
    >
      <Container maxWidth={false}>
        <Toolbar variant="dense" style={{ minHeight: "35px" }} disableGutters>
          <div
            style={{
              //@ts-expect-error
              WebkitAppRegion: "no-drag",
            }}
          >
            <QuadraticMenu></QuadraticMenu>
          </div>
        </Toolbar>
      </Container>
    </AppBar>
  );
};
