import { authClient } from '@/auth/auth';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { redirect, useLoaderData, useNavigate, type LoaderFunctionArgs } from 'react-router';
import type z from 'zod';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const pendingAuthenticationToken = url.searchParams.get('pendingAuthenticationToken');
  if (!pendingAuthenticationToken) {
    return redirect(ROUTES.LOGIN);
  }

  return { pendingAuthenticationToken };
};

export const Component = () => {
  const { pendingAuthenticationToken } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formSchema = useMemo(() => ApiSchemas['/v0/auth/verify-email.POST.request'], []);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pendingAuthenticationToken,
      code: '',
    },
  });

  const handleSubmitForm = useCallback(
    async (data: z.infer<typeof formSchema>) => {
      try {
        setErrorMessage(null);

        await authClient.verifyEmail({
          pendingAuthenticationToken: data.pendingAuthenticationToken,
          code: data.code,
        });

        const { search } = new URL(window.location.href);
        navigate(`${ROUTES.LOGIN_RESULT}${search}`);
      } catch (error) {
        console.error(error);

        setErrorMessage('Invalid or expired code');
      }
    },
    [navigate]
  );

  return (
    <>
      <h1 className="text-2xl font-medium">Verify email</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmitForm)} className="flex w-full flex-col gap-6">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl>
                  <Input
                    data-testid="verify-email-code"
                    className="h-12 rounded-md border border-gray-300 px-3 text-base"
                    autoCapitalize="off"
                    type="text"
                    autoFocus
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            data-testid="verify-email-submit"
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-12 w-full rounded-md text-base font-medium"
          >
            Continue
          </Button>
        </form>

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      </Form>
    </>
  );
};
