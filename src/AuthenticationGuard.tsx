import { withAuthenticationRequired } from '@auth0/auth0-react';
import React from 'react';
import { QuadraticLoading } from './ui/loading/QuadraticLoading';

export const AuthenticationGuard = ({ component }: { component: React.ComponentType }) => {
  const Component = withAuthenticationRequired(component, {
    onRedirecting: () => (
      <div className="page-layout">
        <QuadraticLoading />
      </div>
    ),
  });

  return <Component />;
};
