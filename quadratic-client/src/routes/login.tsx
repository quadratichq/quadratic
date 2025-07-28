import { AUTH_TYPE, authClient } from '@/auth/auth';
import { ROUTES } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { useCallback, useMemo, useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { useSearchParams } from 'react-router';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirectTo') || '/';
  // const isSignupFlow = url.searchParams.get('signup') !== null;

  const isAuthenticated = await authClient.isAuthenticated();
  if (isAuthenticated) {
    window.location.assign(redirectTo);
  }

  // else if (AUTH_TYPE !== 'workos') {
  //   await authClient.login(redirectTo, isSignupFlow);
  // }
};

export const Component = () => {
  const [searchParams] = useSearchParams();
  const isSignupFlow = searchParams.get('signup') !== null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const redirectTo = useMemo(() => {
    const url = new URL(window.location.href);
    let redirectTo = url.searchParams.get('redirectTo');
    if (!redirectTo) {
      url.pathname = 'login-result';
      redirectTo = url.toString();
    }
    return redirectTo;
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      e.stopPropagation();
      await authClient.loginWithPassword({ email, password, redirectTo });
    },
    [email, password, redirectTo]
  );

  const handleOAuth = useCallback(
    (provider: 'GoogleOAuth' | 'MicrosoftOAuth' | 'GitHubOAuth' | 'AppleOAuth') => {
      window.location.assign(ROUTES.WORKOS_OAUTH({ redirectTo, provider }));
    },
    [redirectTo]
  );

  useRemoveInitialLoadingUI(true);

  if (AUTH_TYPE !== 'workos') {
    return null;
  }

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-4">
      <h1>{isSignupFlow ? 'Sign-up' : 'Sign-in'}</h1>

      <h2>Email + Password</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            type="email"
            name="email"
            id="email"
            autoCapitalize="off"
            autoComplete="username"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            type="password"
            name="password"
            id="password"
            autoCapitalize="off"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div>
          <button type="submit">Sign-in</button>
        </div>

        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => handleOAuth('GoogleOAuth')}>
            Sign-in with Google
          </button>

          <button type="button" onClick={() => handleOAuth('MicrosoftOAuth')}>
            Sign-in with Microsoft
          </button>

          <button type="button" onClick={() => handleOAuth('GitHubOAuth')}>
            Sign-in with GitHub
          </button>

          <button type="button" onClick={() => handleOAuth('AppleOAuth')}>
            Sign-in with Apple
          </button>
        </div>
      </form>
    </main>
  );
};
