import { Box } from "@mui/system";
import colors from "../../../theme/colors";

export const BottomBar = () => {
  return (
    <Box
      sx={{
        position: "fixed",
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        color: colors.darkGray,
        bottom: 0,
        width: "100%",
        height: "1.5rem",
        backdropFilter: "blur(1px)",
        display: "flex",
        justifyContent: "space-between",
        paddingLeft: "1rem",
        paddingRight: "1rem",
        fontFamily: "sans-serif",
        fontSize: "0.7rem",
        userSelect: "none",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
        }}
      >
        <span>You, 30 seconds ago.</span>
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <span>x: 0, y: 0</span>
        <span>✓ WebGL</span>
        <span>✓ Python</span>
        <span>✕ SQL</span>
        <span>✕ JS</span>
      </Box>
    </Box>
  );
};
