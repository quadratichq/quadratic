import { AvatarTeam } from '@/components/AvatarTeam';
import { TYPE } from '@/constants/appConstants';
import { Button } from '@/shadcn/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shadcn/ui/form';
import { Input } from '@/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { TeamSchema } from 'quadratic-shared/typesAndSchemas';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActionFunctionArgs, redirect, useSubmit } from 'react-router-dom';
import z from 'zod';
import { apiClient } from '../api/apiClient';
import { DashboardHeader } from '../dashboard/components/DashboardHeader';
import { TeamLogoDialog, TeamLogoInput } from '../dashboard/components/TeamLogo';

type ActionData = {
  name: string;
  picture?: string;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // TODO convert blob URL to File and upload to S3
  const data: ActionData = await request.json();
  const { uuid } = await apiClient.teams.create(data);
  // await new Promise((resolve) => setTimeout(resolve, 5000));
  // TODO make dialog=share a const, or maybe share=1 or share=first for extra UI

  const checkoutSessionUrl = await apiClient.teams.billing.getCheckoutSessionUrl(uuid);
  return redirect(checkoutSessionUrl.url);
};

const FormSchema = z.object({
  name: TeamSchema.shape.name,
});

export const Component = () => {
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string>('');
  const [userSelectedLogoUrl, setUserSelectedLogoUrl] = useState<string>('');

  const submit = useSubmit();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = (data: z.infer<typeof FormSchema>) => {
    const actionData: ActionData = { name: data.name /* TODO picture: currentLogoUrl */ };
    submit(actionData, { method: 'POST', encType: 'application/json' });
  };

  return (
    <>
      <DashboardHeader title="Create a Team" />

      <div className={`mt-4 max-w-md space-y-8`}>
        <p className={`${TYPE.body2} text-muted-foreground`}>
          Teams are for collaborating on files with other people. Once you create a team, you can invite people to it.
        </p>

        <div className={`flex flex-row items-center gap-2`}>
          <AvatarTeam src={currentLogoUrl} />
          {/* <AvatarWithLetters size="large" src={currentLogoUrl}>
            {form.watch('name')}
          </AvatarWithLetters> */}
          <div className={`text-muted-foreground`}>
            {currentLogoUrl ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setCurrentLogoUrl('');
                }}
              >
                Remove logo
              </Button>
            ) : (
              <Button variant="ghost" asChild>
                <label>
                  Add logo
                  <TeamLogoInput onChange={(logoUrl: string) => setUserSelectedLogoUrl(logoUrl)} />
                </label>
              </Button>
            )}
          </div>
          {userSelectedLogoUrl && (
            <TeamLogoDialog
              onClose={() => setUserSelectedLogoUrl('')}
              logoUrl={userSelectedLogoUrl}
              onSave={(logoUrl: string) => {
                setCurrentLogoUrl(logoUrl);
                setUserSelectedLogoUrl('');
                // TODO window.URL.revokeObjectURL(avatarUrl) when file uploads
              }}
            />
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" variant="default">
              Continue
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
};
