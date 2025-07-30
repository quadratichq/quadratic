import { authClient } from '@/auth/auth';
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

export const SendMagicAuthCode = memo(() => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formSchema = useMemo(() => ApiSchemas['/auth/sendMagicAuthCode.POST.request'], []);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  const handleSubmitForm = useCallback(
    async (data: z.infer<typeof formSchema>) => {
      try {
        setErrorMessage(null);

        await authClient.sendMagicAuthCode({ email: data.email });

        const { search } = new URL(window.location.href);
        navigate(`${ROUTES.MAGIC_AUTH_CODE}${search}?email=${encodeURIComponent(data.email)}`);
      } catch (error) {
        console.error(error);
        setErrorMessage('Invalid email');
      }
    },
    [navigate]
  );

  return (
    <>
      <h1 className="text-2xl font-medium">Send Magic Code</h1>

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
    </>
  );
});
