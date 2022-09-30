import * as React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

export const WelcomeScreen = () => {
  const {
    isLoading: isAuth0Loading,
    error,
    // user,
    loginWithRedirect,
    // logout,
  } = useAuth0();

  if (isAuth0Loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    console.log(error);
    return <div>Oops... {error.message}</div>;
  }

  return (
    <div>
      <h1>Welcome to Quadratic</h1>
      <h2>Quadratic is currently in Alpha</h2>
      <button onClick={() => loginWithRedirect()}>Log In</button>
    </div>
  );
};
