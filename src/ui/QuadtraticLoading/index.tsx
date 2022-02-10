import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";

import "./styles.css";
import { useLoading } from "../../contexts/LoadingContext";

export function QuadraticLoading() {
  const { setLoading } = useLoading();
  const [progress, setProgress] = useState<number>(0);

  const loadingMS = 4000;

  // Super Hacky Way To Set Loading...
  setTimeout(() => {
    setLoading(false);
  }, loadingMS);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress === 100) {
          return 100;
        }
        return oldProgress + 1;
      });
    }, loadingMS / 100);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div className="loadingContainer">
        <img
          className="loadingLogoGif"
          src="/images/logo_loading.gif"
          alt="Loading Quadratic Grid"
        ></img>
        <Box sx={{ width: "100px", marginTop: "15px" }}>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      </div>
    </div>
  );
}
