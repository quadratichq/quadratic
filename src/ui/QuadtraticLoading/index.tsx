import "./styles.css";

export function QuadraticLoading() {
  return (
    <div style={{ height: "100%", display: "flex", justifyContent: "center" }}>
      <div className="loadingContainer">
        <img
          className="loadingLogoGif"
          src="/images/logo_loading.gif"
          alt="Loading Quadratic Grid"
        ></img>
      </div>
    </div>
  );
}
