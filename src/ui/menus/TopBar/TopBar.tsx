import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Container from "@mui/material/Container";

import { QuadraticMenu } from "./QuadraticMenu";

export const TopBar = () => {
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
          <QuadraticMenu></QuadraticMenu>
        </Toolbar>
      </Container>
    </AppBar>
  );
};
