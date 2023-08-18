import { useLocation } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { TopBarLoading } from '../components/TopBarLoading';
import { DashboardLoading } from './DashboardLoading';
import { QuadraticLoading } from './QuadraticLoading';

export const LoadingScreen = () => {
  const location = useLocation();

  // Use a different loading screen for the dashboard vs quadratic app
  let LoadingComponent = <DashboardLoading />;
  if (location.pathname.startsWith(ROUTES.FILE('')) || location.pathname.startsWith(ROUTES.CREATE_FILE)) {
    LoadingComponent = <QuadraticLoading />;
  }

  return (
    <>
      {/* ToBarLoading allows window to be moved while loading in electron */}
      <TopBarLoading></TopBarLoading>
      <div
        style={{
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <div className="loadingContainer">{LoadingComponent}</div>
      </div>
    </>
  );
};
