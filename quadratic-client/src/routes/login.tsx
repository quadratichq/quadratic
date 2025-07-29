import { authClient, type OAuthProvider } from '@/auth/auth';
import { waitForAuthClientToRedirect } from '@/auth/auth.helper';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { GoogleOAuthLogo, MicrosoftOAuthLogo } from '@/shared/components/OAuthLogo';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useRouteError, useSearchParams } from 'react-router';
import type z from 'zod';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirectTo') || '/';
  const isSignupFlow = url.searchParams.get(SEARCH_PARAMS.SIGNUP.KEY) !== null;

  const isAuthenticated = await authClient.isAuthenticated();
  if (isAuthenticated) {
    window.location.assign(redirectTo);
    await waitForAuthClientToRedirect();
  } else {
    const isRedirecting = await authClient.login(redirectTo, isSignupFlow);
    return { isRedirecting };
  }

  return { isRedirecting: false };
};

export const Component = () => {
  const { isRedirecting } = useLoaderData<typeof loader>();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const isSignupFlow = useMemo(() => searchParams.get(SEARCH_PARAMS.SIGNUP.KEY) !== null, [searchParams]);

  const toggleSignupFlow = useCallback(() => {
    setSearchParams((prev) => {
      if (isSignupFlow) {
        prev.delete(SEARCH_PARAMS.SIGNUP.KEY);
      } else {
        prev.set(SEARCH_PARAMS.SIGNUP.KEY, 'true');
      }
      return prev;
    });
    setErrorMessage(null);
  }, [setSearchParams, isSignupFlow]);

  const redirectTo = useMemo(() => {
    const url = new URL(window.location.href);
    let redirectTo = url.searchParams.get('redirectTo');
    if (!redirectTo) {
      url.pathname = 'login-result';
      redirectTo = url.toString();
    }
    return redirectTo;
  }, []);

  useRemoveInitialLoadingUI(true);

  if (isRedirecting) {
    return null;
  }

  return (
    <main className="flex h-screen select-none flex-col items-center justify-center bg-background">
      <div className="relative flex w-[400px] flex-col overflow-hidden rounded-md bg-white font-sans text-base font-normal leading-4 text-gray-900 antialiased shadow-[0_12px_40px_0_rgba(0,0,0,0.12)]">
        <div className="flex flex-grow flex-col items-center justify-center gap-6 p-10">
          <img src="/logo192.png" alt="Quadratic Logo" className="h-12 w-12" />

          <h1 className="text-2xl font-medium">{isSignupFlow ? 'Sign up for' : 'Log in to'} Quadratic</h1>

          <LoginForm
            isSignupFlow={isSignupFlow}
            redirectTo={redirectTo}
            errorMessage={errorMessage}
            setErrorMessage={setErrorMessage}
          />

          <SignUpToggle isSignupFlow={isSignupFlow} toggleSignupFlow={toggleSignupFlow} />

          <OAuthButtons redirectTo={redirectTo} setErrorMessage={setErrorMessage} />
        </div>
      </div>
    </main>
  );
};

const LoginForm = memo(
  ({
    isSignupFlow,
    redirectTo,
    errorMessage,
    setErrorMessage,
  }: {
    isSignupFlow: boolean;
    redirectTo: string;
    errorMessage: string | null;
    setErrorMessage: (errorMessage: string | null) => void;
  }) => {
    const formSchema = useMemo(() => {
      return isSignupFlow
        ? ApiSchemas['/auth/signupWithPassword.POST.request']
        : ApiSchemas['/auth/loginWithPassword.POST.request'];
    }, [isSignupFlow]);

    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        email: '',
        password: '',
        firstName: '',
        lastName: '',
      },
    });

    const handleSubmitForm = useCallback(
      async (data: z.infer<typeof formSchema>) => {
        try {
          setErrorMessage(null);

          if (!isSignupFlow) {
            await authClient.loginWithPassword({
              email: data.email,
              password: data.password,
              redirectTo,
            });
          } else if (data.firstName && data.lastName) {
            await authClient.signupWithPassword({
              email: data.email,
              password: data.password,
              firstName: data.firstName,
              lastName: data.lastName,
              redirectTo,
            });
          }
        } catch (error) {
          console.error(error);
          setErrorMessage('Invalid email or password');
        }
      },
      [isSignupFlow, redirectTo, setErrorMessage]
    );

    useEffect(() => {
      form.clearErrors('root');
      form.clearErrors('email');
      form.clearErrors('password');
      form.clearErrors('firstName');
      form.clearErrors('lastName');
    }, [form, isSignupFlow]);

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmitForm)} className="flex w-full flex-col gap-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    data-testid="login-email"
                    className="h-12 rounded-md border border-gray-300 px-3 text-base"
                    autoCapitalize="off"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    placeholder="Work email*"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    data-testid="login-password"
                    className="h-12 rounded-md border border-gray-300 px-3 text-base"
                    autoCapitalize="off"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password*"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {isSignupFlow && (
            <div className="flex flex-row gap-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="login-first-name"
                        className="h-12 rounded-md border border-gray-300 px-3 text-base"
                        autoCapitalize="off"
                        type="text"
                        autoComplete="given-name"
                        placeholder="First name*"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="login-last-name"
                        className="h-12 rounded-md border border-gray-300 px-3 text-base"
                        autoCapitalize="off"
                        type="text"
                        autoComplete="family-name"
                        placeholder="Last name*"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          <Button
            data-testid="login-submit"
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-12 w-full rounded-md bg-blue-600 text-base font-medium hover:bg-blue-700"
          >
            Continue
          </Button>
        </form>

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      </Form>
    );
  }
);

const SignUpToggle = memo(
  ({ isSignupFlow, toggleSignupFlow }: { isSignupFlow: boolean; toggleSignupFlow: () => void }) => {
    return (
      <p className="flex flex-row gap-1 text-sm text-gray-600">
        {isSignupFlow ? 'Already have an account?' : "Don't have an account?"}
        <button
          data-testid="switch-to-login"
          onClick={toggleSignupFlow}
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          {isSignupFlow ? 'Log in' : 'Sign up'}
        </button>
      </p>
    );
  }
);

const OAuthButtons = memo(
  ({ redirectTo, setErrorMessage }: { redirectTo: string; setErrorMessage: (errorMessage: string | null) => void }) => {
    const handleOAuth = useCallback(
      async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        e.stopPropagation();
        setErrorMessage(null);
        try {
          if (['GoogleOAuth', 'MicrosoftOAuth', 'GitHubOAuth', 'AppleOAuth'].includes(e.currentTarget.value)) {
            const provider = e.currentTarget.value as OAuthProvider;
            await authClient.loginWithOAuth({ provider, redirectTo });
          }
        } catch (error) {
          console.error(error);
          setErrorMessage('Failed to login with OAuth');
        }
      },
      [redirectTo, setErrorMessage]
    );

    const isInIframe = useMemo(() => {
      return window.parent !== window;
    }, []);

    if (isInIframe) {
      return null;
    }

    return (
      <>
        <div className="flex w-full items-center gap-4">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="text-sm text-gray-500">OR</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        <div className="flex w-full flex-row gap-4">
          <Button
            type="button"
            value="GoogleOAuth"
            onClick={handleOAuth}
            variant="outline"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white text-base font-medium hover:bg-gray-50"
          >
            <GoogleOAuthLogo />
            Google
          </Button>

          <Button
            type="button"
            value="MicrosoftOAuth"
            onClick={handleOAuth}
            variant="outline"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white text-base font-medium hover:bg-gray-50"
          >
            <MicrosoftOAuthLogo />
            Microsoft
          </Button>
        </div>
      </>
    );
  }
);

export const ErrorBoundary = () => {
  const error = useRouteError();
  console.error(error);

  return (
    <EmptyPage
      title="Something went wrong"
      description="An unexpected error occurred. Try reloading the page or contact us if the error continues."
      Icon={ExclamationTriangleIcon}
      error={error}
    />
  );
};
