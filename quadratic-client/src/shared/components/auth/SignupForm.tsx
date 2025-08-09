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

export const SignupForm = memo(() => {
  const navigate = useNavigate();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formSchema = useMemo(() => ApiSchemas['/auth/signupWithPassword.POST.request'], []);
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

        await authClient.signupWithPassword({
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
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
      <h1 className="text-2xl font-medium">{'Sign up for Quadratic'}</h1>

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
                <FormLabel>{'Password'}</FormLabel>
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

          <div className="flex flex-row gap-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{'First name'}</FormLabel>
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
                  <FormLabel>{'Last name'}</FormLabel>
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

      <SwitchToLogin />

      <OAuthButtons />
    </>
  );
});

const SwitchToLogin = memo(() => {
  const navigate = useNavigate();
  const switchToLogin = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      e.stopPropagation();
      const { search } = new URL(window.location.href);
      navigate(`${ROUTES.LOGIN}${search}`);
    },
    [navigate]
  );

  return (
    <p className="flex flex-row gap-1 text-sm text-gray-600">
      {'Already have an account?'}
      <button
        data-testid="switch-to-login"
        onClick={switchToLogin}
        className="font-medium text-primary hover:text-primary/80"
      >
        {'Log in'}
      </button>
    </p>
  );
});
