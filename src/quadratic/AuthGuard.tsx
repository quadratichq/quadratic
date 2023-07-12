import React from 'react';
import { withAuthenticationRequired } from '@auth0/auth0-react';
import { QuadraticLoading } from '../ui/loading/QuadraticLoading';

export const AuthGuard = ({ component }: { component: React.ComponentType }) => {
  const Component = withAuthenticationRequired(component, {
    onRedirecting: QuadraticLoading,
  });

  return <Component />;
};
