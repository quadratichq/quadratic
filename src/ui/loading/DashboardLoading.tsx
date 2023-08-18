import './styles.css';

export function DashboardLoading() {
  return (
    <>
      <img className="loadingLogoGif" src="/images/logo_loading_minimal.svg" alt="Loading Quadratic Grid"></img>
      <img
        style={{
          width: '60px',
          height: '60px',
        }}
        src="/images/DotsLoading.svg"
        alt="Loading Quadratic Grid"
      ></img>
    </>
  );
}
