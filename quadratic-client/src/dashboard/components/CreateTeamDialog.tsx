import { useGlobalSnackbar } from '@/components/GlobalSnackbarProvider';
import { useDashboardContext } from '@/routes/_dashboard';
import { Button } from '@/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shadcn/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shadcn/ui/form';
import { Input } from '@/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckIcon, PersonIcon, ReloadIcon } from '@radix-ui/react-icons';
import { TeamSchema } from 'quadratic-shared/typesAndSchemas';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActionFunctionArgs, redirect } from 'react-router-dom';
import z from 'zod';
import { apiClient } from '../../api/apiClient';

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

export const CreateTeamDialog = () => {
  const [, setDashboardState] = useDashboardContext();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [showPlans, setShowPlans] = useState(true);
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'error'>('idle');
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    if (submitState === 'error') {
      addGlobalSnackbar('Failed to create team. Try again', { severity: 'error' });
    }
  }, [submitState, addGlobalSnackbar]);

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    setSubmitState('submitting');
    try {
      // Create team in DB
      const { uuid } = await apiClient.teams.create({ name: data.name });
      // Redirect to stripe billing
      const { url } = await apiClient.teams.billing.getCheckoutSessionUrl(uuid);
      window.location.href = url;
    } catch (error) {
      console.error(error);
      setSubmitState('error');
    }
  };
  const onClose = () => {
    setShowPlans(true);
    setDashboardState((prev) => ({ ...prev, showCreateTeamDialog: false }));
  };
  const plans = [
    {
      title: 'Personal',
      price: 'Free',
      features: ['Unlimited files', 'Limited file sharing', 'Throttled AI usage', 'Best effort support'],
    },
    {
      title: 'Team',
      price: '$18 / user / month',
      features: ['Shared team workspace', 'Unlimited sharing', 'Unlimited AI usage ', 'Priority support'],
    },
  ];
  const disabled = submitState === 'submitting';

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>Teams are a collaborative space for working with other people.</DialogDescription>
        </DialogHeader>
        <div>
          {showPlans ? (
            <div className="flex flex-row gap-8">
              {plans.map(({ title, price, features }, i) => (
                <div key={i} className={`${title === 'Team' ? 'flex-grow border-l border-border pl-8' : ''}`}>
                  <div className="flex items-center">
                    <div className="flex w-10 items-center justify-center">
                      <PersonIcon />
                      {title === 'Team' && <PersonIcon className="-ml-1" />}
                    </div>

                    <h2 className="text-xl font-semibold">{title}</h2>
                  </div>
                  <div className="mb-4 ml-10">
                    <p className="mb-1">{price}</p>
                    <ul className="-ml-10 text-sm text-muted-foreground">
                      {features.map((feature, k) => (
                        <li key={k} className="flex items-start">
                          <div className="flex w-10 items-center justify-center">
                            <CheckIcon className="mt-0.5 opacity-50" />
                          </div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {title === 'Team' && (
                    <div>
                      <Button variant="default" className="w-full" onClick={() => setShowPlans(false)}>
                        Continue
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team name</FormLabel>
                      <FormControl>
                        <Input {...field} autoFocus autoComplete="off" disabled={disabled} />
                      </FormControl>
                      <FormDescription>You can always change this later</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="mr-auto flex items-center gap-2 text-muted-foreground"
                    onClick={() => {
                      form.clearErrors();
                      setShowPlans(true);
                    }}
                    disabled={disabled}
                  >
                    Back to plans
                  </Button>
                  <Button type="button" variant="outline" onClick={onClose} disabled={disabled}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="default" disabled={disabled}>
                    {submitState === 'submitting' && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />} Continue to
                    billing
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
