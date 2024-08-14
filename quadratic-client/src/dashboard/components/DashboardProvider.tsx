import { createContext, ReactNode, useContext, useState } from 'react';

type DashboardState = {
  showNewFileDialog: boolean;
};

const initialDashboardState: DashboardState = {
  showNewFileDialog: false,
};

const DashboardContext = createContext<
  [DashboardState, React.Dispatch<React.SetStateAction<DashboardState>>] | undefined
>(undefined);

export const useDashboardState = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardState must be used within a DashboardContextProvider');
  }
  return context;
};

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [dashboardState, setDashboardState] = useState(initialDashboardState);

  return <DashboardContext.Provider value={[dashboardState, setDashboardState]}>{children}</DashboardContext.Provider>;
};
