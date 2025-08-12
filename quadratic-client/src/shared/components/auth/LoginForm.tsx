import { authClient } from '@/auth/auth';
import { OAuthButtons } from '@/shared/components/auth/OuthButtons';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { memo, useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type z from 'zod';

export const LoginForm = memo(() => {
  const navigate = useNavigate();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formSchema = useMemo(() => ApiSchemas['/v0/auth/login-with-password.POST.request'], []);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleSubmitForm = useCallback(
    async (data: z.infer<typeof formSchema>) => {
      try {
        setErrorMessage(null);

        await authClient.loginWithPassword({
          email: data.email,
          password: data.password,
        });

        const { search } = new URL(window.location.href);
        navigate(`${ROUTES.LOGIN_RESULT}${search}`);
      } catch (error) {
        console.error(error);
        setErrorMessage('Invalid email or password');
      }
    },
    [navigate]
  );

  return (
    <>
      <h1 className="text-2xl font-medium">{'Log in to Quadratic'}</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmitForm)} className="flex w-full flex-col gap-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{'Email'}</FormLabel>
                <FormControl>
                  <Input
                    data-testid="login-email"
                    className="h-12 rounded-md border border-gray-300 px-3 text-base"
                    autoCapitalize="off"
                    type="text"
                    autoComplete="username"
                    autoFocus
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
                <FormLabel>{'Password'}</FormLabel>
                <FormControl>
                  <Input
                    data-testid="login-password"
                    className="h-12 rounded-md border border-gray-300 px-3 text-base"
                    autoCapitalize="off"
                    type="password"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            data-testid="login-submit"
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-12 w-full rounded-md text-base font-medium"
          >
            {'Continue'}
          </Button>
        </form>

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      </Form>

      <div className="flex flex-row gap-8">
        <SwitchToMagicAuthCode />

        <SwitchToResetPassword />
      </div>

      <SwitchToSignup />

      <OAuthButtons />
    </>
  );
});

const SwitchToMagicAuthCode = memo(() => {
  const navigate = useNavigate();
  const switchToMagicAuthCode = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      e.stopPropagation();
      const { search } = new URL(window.location.href);
      navigate(`${ROUTES.SEND_MAGIC_AUTH_CODE}${search}`);
    },
    [navigate]
  );

  return (
    <button
      data-testid="send-magic-auth-code"
      onClick={switchToMagicAuthCode}
      className="text-sm font-medium text-primary hover:text-primary/80"
    >
      {'Magic code'}
    </button>
  );
});

const SwitchToResetPassword = memo(() => {
  const navigate = useNavigate();
  const switchToResetPassword = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      e.stopPropagation();
      const { search } = new URL(window.location.href);
      navigate(`${ROUTES.SEND_RESET_PASSWORD}${search}`);
    },
    [navigate]
  );

  return (
    <button
      data-testid="reset-password"
      onClick={switchToResetPassword}
      className="text-sm font-medium text-primary hover:text-primary/80"
    >
      {'Reset password'}
    </button>
  );
});

const SwitchToSignup = memo(() => {
  const navigate = useNavigate();
  const switchToSignup = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      e.stopPropagation();
      const { search } = new URL(window.location.href);
      navigate(`${ROUTES.SIGNUP}${search}`);
    },
    [navigate]
  );

  return (
    <p className="flex flex-row gap-1 text-sm text-gray-600">
      {"Don't have an account?"}
      <button
        data-testid="switch-to-signup"
        onClick={switchToSignup}
        className="font-medium text-primary hover:text-primary/80"
      >
        {'Sign up'}
      </button>
    </p>
  );
});
