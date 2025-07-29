import { authClient } from '@/auth/auth';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { LoginFormWrapper } from '@/shared/components/auth/LoginFormWrapper';
import { ROUTES } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { redirect, useLoaderData, useRouteError, type LoaderFunctionArgs } from 'react-router';
import type z from 'zod';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return redirect(ROUTES.LOGIN);
  }

  return { token };
};

export const Component = () => {
  const { token } = useLoaderData<typeof loader>();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    const url = new URL(window.location.href);
    let redirectTo = url.searchParams.get('redirectTo');
    if (!redirectTo) {
      url.pathname = 'login-result';
      redirectTo = url.toString();
    }
    return redirectTo;
  }, []);

  const formSchema = useMemo(() => ApiSchemas['/auth/resetPassword.POST.request'], []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      token,
      password: '',
    },
  });

  const handleSubmitForm = useCallback(
    async (data: z.infer<typeof formSchema>) => {
      try {
        setErrorMessage(null);

        await authClient.resetPassword({
          token: data.token,
          password: data.password,
          redirectTo,
        });
      } catch (error) {
        console.error(error);

        setErrorMessage('Invalid token or password');
      }
    },
    [redirectTo]
  );

  useRemoveInitialLoadingUI(true);

  return (
    <LoginFormWrapper>
      <h1 className="text-2xl font-medium">Reset Password</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmitForm)} className="flex w-full flex-col gap-6">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input
                    data-testid="reset-password-password"
                    className="h-12 rounded-md border border-gray-300 px-3 text-base"
                    autoCapitalize="off"
                    type="password"
                    autoFocus
                    placeholder="New Password*"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            data-testid="reset-password-submit"
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-12 w-full rounded-md text-base font-medium"
          >
            Continue
          </Button>
        </form>

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      </Form>
    </LoginFormWrapper>
  );
};

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
