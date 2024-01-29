import { TYPE } from '@/constants/appConstants';
import { Button } from '@/shadcn/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shadcn/ui/form';
import { Input } from '@/shadcn/ui/input';
import { RadioGroup, RadioGroupItem } from '@/shadcn/ui/radio-group';
import { cn } from '@/shadcn/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { TeamSchema } from 'quadratic-shared/typesAndSchemas';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActionFunctionArgs, redirect, useSubmit } from 'react-router-dom';
import z from 'zod';
import { apiClient } from '../api/apiClient';
import { AvatarWithLetters } from '../components/AvatarWithLetters';
import { ROUTES } from '../constants/routes';
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
  return redirect(ROUTES.TEAM(uuid) + '?share=team-created');
};

const FormSchema = z.object({
  name: TeamSchema.shape.name,
  billing: z.string(),
});

const billingOptions = [
  { label: 'Beta trial', value: '0', price: 'Free' },
  { label: 'Monthly', value: '1', price: '$--/usr/month', disabled: true },
  { label: 'Yearly', value: '2', price: '$--/usr/year', disabled: true },
];

export const Component = () => {
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string>('');
  const [userSelectedLogoUrl, setUserSelectedLogoUrl] = useState<string>('');
  const submit = useSubmit();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      billing: billingOptions[0].value,
    },
  });

  const onSubmit = (data: z.infer<typeof FormSchema>) => {
    const actionData: ActionData = { name: data.name /* TODO picture: currentLogoUrl */ };
    submit(actionData, { method: 'POST', encType: 'application/json' });
  };

  return (
    <>
      <DashboardHeader title="Create team" />

      <div className={`mt-4 max-w-md space-y-8`}>
        <p className={`${TYPE.body2} text-muted-foreground`}>
          Teams are for collaborating on files with other people. Once you create a team, you can invite people to it.
        </p>

        <div className={`flex flex-row items-center gap-2`}>
          <AvatarWithLetters size="large" src={currentLogoUrl}>
            {form.watch('name')}
          </AvatarWithLetters>
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
            <FormField
              control={form.control}
              name="billing"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col gap-0 border border-input shadow-sm"
                    >
                      {billingOptions.map(({ label, value, price, disabled }, i) => (
                        <FormItem
                          key={value}
                          className={cn(`flex items-center px-2 py-3`, i !== 0 && `border-t border-input`)}
                        >
                          <FormControl>
                            <RadioGroupItem value={value} disabled={disabled} className={cn(disabled && `grayscale`)} />
                          </FormControl>
                          <FormLabel
                            className={cn(
                              `!mt-0 ml-2 flex flex-1 justify-between p-0`,
                              disabled && 'text-muted-foreground'
                            )}
                          >
                            <span>{label}</span>
                            <span className={`font-normal text-muted-foreground`}>{price}</span>
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>
                    [Note here about billing, beta plan termination date, free tier limits, etc.]
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" variant="default">
              Submit
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
};
