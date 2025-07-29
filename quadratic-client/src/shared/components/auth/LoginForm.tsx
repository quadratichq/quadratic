import { authClient, type OAuthProvider } from '@/auth/auth';
import {
  AppleOAuthLogo,
  GitHubOAuthLogo,
  GoogleOAuthLogo,
  MicrosoftOAuthLogo,
} from '@/shared/components/auth/OAuthLogo';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import type z from 'zod';

export const LoginForm = memo(({ redirectTo }: { redirectTo: string }) => {
  const [searchParams] = useSearchParams();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSignupFlow = useMemo(
    () => searchParams.get(SEARCH_PARAMS.LOGIN_TYPE.KEY)?.toLowerCase() === SEARCH_PARAMS.LOGIN_TYPE.VALUES.SIGNUP,
    [searchParams]
  );

  const formSchema = useMemo(
    () =>
      isSignupFlow
        ? ApiSchemas['/auth/signupWithPassword.POST.request']
        : ApiSchemas['/auth/loginWithPassword.POST.request'],
    [isSignupFlow]
  );

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
    <>
      <h1 className="text-2xl font-medium">{`${isSignupFlow ? 'Sign up for' : 'Log in to'} Quadratic`}</h1>

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
            className="h-12 w-full rounded-md text-base font-medium"
          >
            Continue
          </Button>
        </form>

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      </Form>

      <div className={`flex flex-row gap-4 ${isSignupFlow ? 'hidden' : ''}`}>
        <SendMagicAuthCode isSignupFlow={isSignupFlow} setErrorMessage={setErrorMessage} />

        <ResetPassword isSignupFlow={isSignupFlow} setErrorMessage={setErrorMessage} />
      </div>

      <SignUpToggle isSignupFlow={isSignupFlow} setErrorMessage={setErrorMessage} />

      <OAuthButtons redirectTo={redirectTo} setErrorMessage={setErrorMessage} />
    </>
  );
});

const ResetPassword = memo(
  ({
    isSignupFlow,
    setErrorMessage,
  }: {
    isSignupFlow: boolean;
    setErrorMessage: (errorMessage: string | null) => void;
  }) => {
    const handleResetPassword = useCallback(
      async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        try {
          e.preventDefault();
          e.stopPropagation();
          setErrorMessage(null);

          await authClient.sendResetPassword({ email: 'ayush.agrawal+1@quadratichq.com' });
        } catch (error) {
          console.error(error);
          setErrorMessage('Failed to send reset password email');
        }
      },
      [setErrorMessage]
    );

    if (isSignupFlow) {
      return null;
    }

    return (
      <button
        data-testid="reset-password"
        onClick={handleResetPassword}
        className="text-sm font-medium text-primary hover:text-primary/80"
      >
        Reset Password
      </button>
    );
  }
);

const SendMagicAuthCode = memo(
  ({
    isSignupFlow,
    setErrorMessage,
  }: {
    isSignupFlow: boolean;
    setErrorMessage: (errorMessage: string | null) => void;
  }) => {
    const handleSendMagicAuthCode = useCallback(
      async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        try {
          e.preventDefault();
          e.stopPropagation();
          setErrorMessage(null);

          await authClient.sendMagicAuthCode({ email: 'ayush.agrawal+1@quadratichq.com' });
        } catch (error) {
          console.error(error);
          setErrorMessage('Failed to send reset password email');
        }
      },
      [setErrorMessage]
    );

    if (isSignupFlow) {
      return null;
    }

    return (
      <button
        data-testid="send-magic-auth-code"
        onClick={handleSendMagicAuthCode}
        className="text-sm font-medium text-primary hover:text-primary/80"
      >
        Magic Link
      </button>
    );
  }
);

const SignUpToggle = memo(
  ({
    isSignupFlow,
    setErrorMessage,
  }: {
    isSignupFlow: boolean;
    setErrorMessage: (errorMessage: string | null) => void;
  }) => {
    console.log('isSignupFlow', isSignupFlow);
    const [, setSearchParams] = useSearchParams();

    const toggleSignupFlow = useCallback(() => {
      setErrorMessage(null);
      setSearchParams((prev) => {
        if (isSignupFlow) {
          prev.delete(SEARCH_PARAMS.LOGIN_TYPE.KEY);
        } else {
          prev.set(SEARCH_PARAMS.LOGIN_TYPE.KEY, SEARCH_PARAMS.LOGIN_TYPE.VALUES.SIGNUP);
        }
        return prev;
      });
    }, [setErrorMessage, setSearchParams, isSignupFlow]);

    return (
      <p className="flex flex-row gap-1 text-sm text-gray-600">
        {isSignupFlow ? 'Already have an account?' : "Don't have an account?"}
        <button
          data-testid="switch-to-login"
          onClick={toggleSignupFlow}
          className="font-medium text-primary hover:text-primary/80"
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
        try {
          e.preventDefault();
          e.stopPropagation();
          setErrorMessage(null);

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
            className="flex h-12 w-full items-center justify-center"
          >
            <GoogleOAuthLogo />
          </Button>

          <Button
            type="button"
            value="MicrosoftOAuth"
            onClick={handleOAuth}
            variant="outline"
            className="flex h-12 w-full items-center justify-center"
          >
            <MicrosoftOAuthLogo />
          </Button>

          <Button
            type="button"
            value="GitHubOAuth"
            onClick={handleOAuth}
            variant="outline"
            className="flex h-12 w-full items-center justify-center"
          >
            <GitHubOAuthLogo />
          </Button>

          <Button
            type="button"
            value="AppleOAuth"
            onClick={handleOAuth}
            variant="outline"
            className="flex h-12 w-full items-center justify-center"
          >
            <AppleOAuthLogo />
          </Button>
        </div>
      </>
    );
  }
);
