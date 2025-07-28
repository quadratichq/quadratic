import { authClient } from '@/auth/auth';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { useCallback, useMemo, useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useSearchParams } from 'react-router';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirectTo') || '/';
  const isSignupFlow = url.searchParams.get(SEARCH_PARAMS.SIGNUP.KEY) !== null;

  const isAuthenticated = await authClient.isAuthenticated();
  if (isAuthenticated) {
    window.location.assign(redirectTo);
  } else {
    const isRedirecting = await authClient.login(redirectTo, isSignupFlow);
    return { isRedirecting };
  }

  return { isRedirecting: false };
};

export const Component = () => {
  const { isRedirecting } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSignupFlow = useMemo(() => searchParams.get(SEARCH_PARAMS.SIGNUP.KEY) !== null, [searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const redirectTo = useMemo(() => {
    const url = new URL(window.location.href);
    let redirectTo = url.searchParams.get('redirectTo');
    if (!redirectTo) {
      url.pathname = 'login-result';
      redirectTo = url.toString();
    }
    return redirectTo;
  }, []);

  const isInIframe = useMemo(() => {
    return window.parent !== window;
  }, []);

  const toggleSignupFlow = useCallback(() => {
    setSearchParams((prev) => {
      if (isSignupFlow) {
        prev.delete(SEARCH_PARAMS.SIGNUP.KEY);
      } else {
        prev.set(SEARCH_PARAMS.SIGNUP.KEY, 'true');
      }
      return prev;
    });
  }, [setSearchParams, isSignupFlow]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      e.stopPropagation();
      await authClient.loginWithPassword({ email, password, redirectTo });
    },
    [email, password, redirectTo]
  );

  const handleOAuth = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      e.stopPropagation();
      if (['GoogleOAuth', 'MicrosoftOAuth', 'GitHubOAuth', 'AppleOAuth'].includes(e.currentTarget.value)) {
        const provider = e.currentTarget.value as 'GoogleOAuth' | 'MicrosoftOAuth' | 'GitHubOAuth' | 'AppleOAuth';
        await authClient.loginWithOAuth({ provider, redirectTo });
      }
    },
    [redirectTo]
  );

  useRemoveInitialLoadingUI(true);

  if (isRedirecting) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col items-center justify-center bg-background">
      <div className="relative flex w-[400px] flex-col overflow-hidden rounded-md bg-white font-sans text-base font-normal leading-4 text-gray-900 antialiased shadow-[0_12px_40px_0_rgba(0,0,0,0.12)]">
        <div className="flex flex-grow flex-col items-center justify-center gap-6 p-10">
          <img src="/logo192.png" alt="Quadratic Logo" className="h-12 w-12" />

          <h1 className="text-2xl font-medium">{isSignupFlow ? 'Sign up for' : 'Log in to'} Quadratic</h1>

          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
            <Input
              type="email"
              name="email"
              id="email"
              autoCapitalize="off"
              autoComplete="username"
              autoFocus
              required
              placeholder="Work email*"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-md border border-gray-300 px-3 text-base"
            />

            <Input
              type="password"
              name="password"
              id="password"
              autoCapitalize="off"
              autoComplete="current-password"
              required
              placeholder="Password*"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-md border border-gray-300 px-3 text-base"
            />

            {isSignupFlow && (
              <div className="flex flex-row gap-2">
                <Input
                  hidden={!isSignupFlow}
                  type="text"
                  name="firstName"
                  id="firstName"
                  autoCapitalize="off"
                  autoComplete="given-name"
                  required
                  placeholder="First name*"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-12 rounded-md border border-gray-300 px-3 text-base"
                />

                <Input
                  hidden={!isSignupFlow}
                  type="text"
                  name="lastName"
                  id="lastName"
                  autoCapitalize="off"
                  autoComplete="family-name"
                  required
                  placeholder="Last name*"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-12 rounded-md border border-gray-300 px-3 text-base"
                />
              </div>
            )}

            <Button
              type="submit"
              className="h-12 w-full rounded-md bg-blue-600 text-base font-medium hover:bg-blue-700"
            >
              Continue
            </Button>
          </form>

          {isSignupFlow ? (
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button onClick={toggleSignupFlow} className="font-medium text-blue-600 hover:text-blue-700">
                Log in
              </button>
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button onClick={toggleSignupFlow} className="font-medium text-blue-600 hover:text-blue-700">
                Sign up
              </button>
            </p>
          )}

          <div className="flex w-full items-center gap-4">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="text-sm text-gray-500">OR</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {!isInIframe && (
            <div className="flex w-full flex-row gap-4">
              <Button
                type="button"
                value="GoogleOAuth"
                onClick={handleOAuth}
                variant="outline"
                className="h-12 w-full rounded-md border border-gray-300 bg-white text-base font-medium hover:bg-gray-50"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </Button>

              <Button
                type="button"
                value="MicrosoftOAuth"
                onClick={handleOAuth}
                variant="outline"
                className="h-12 w-full rounded-md border border-gray-300 bg-white text-base font-medium hover:bg-gray-50"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 23 23">
                  <path fill="#f3f3f3" d="M0 0h23v23H0z" />
                  <path fill="#f35325" d="M1 1h10v10H1z" />
                  <path fill="#81bc06" d="M12 1h10v10H12z" />
                  <path fill="#05a6f0" d="M1 12h10v10H1z" />
                  <path fill="#ffba08" d="M12 12h10v10H12z" />
                </svg>
                Microsoft
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
