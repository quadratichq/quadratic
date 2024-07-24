import { apiClient } from '@/shared/api/apiClient';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { ReloadIcon } from '@radix-ui/react-icons';
import { TeamSchema } from 'quadratic-shared/typesAndSchemas';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActionFunctionArgs, redirect, useFetcher, useLocation, useNavigate, useParams } from 'react-router-dom';
import z from 'zod';
type ActionData = {
  name: string;
  picture?: string;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const data: ActionData = await request.json();

  const { uuid } = await apiClient.teams.create(data);
  if (uuid) {
    // const checkoutSessionUrl = await apiClient.teams.billing.getCheckoutSessionUrl(uuid);
    return redirect(ROUTES.TEAM(uuid));
  } else {
    return { ok: false };
  }
};

const FormSchema = z.object({
  name: TeamSchema.shape.name,
});

export const Component = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { teamUuid } = useParams() as { teamUuid: string };
  const [open, setOpen] = useState(true);
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const fetcher = useFetcher();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
    },
  });

  // Open by default. When it closes, close it immediately then navigate.
  useEffect(() => {
    if (!open) {
      if (location.key !== 'default') {
        navigate(-1);
      } else {
        navigate(ROUTES.TEAM(teamUuid));
      }
    }
  }, [open, navigate, teamUuid, location.key]);

  // Show some UI if the team creation failed
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && fetcher.data.ok === false) {
      addGlobalSnackbar('Failed to create team. Try again', { severity: 'error' });
    }
  }, [fetcher, addGlobalSnackbar]);

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    fetcher.submit(data, { method: 'POST', encType: 'application/json' });
  };

  const onClose = () => setOpen(false);

  const disabled = fetcher.state !== 'idle';

  return open ? (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>Teams are a collaborative space for working with other people.</DialogDescription>
        </DialogHeader>
        <div>
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
                <Button type="button" variant="outline" onClick={onClose} disabled={disabled}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" disabled={disabled}>
                  {fetcher.state !== 'idle' && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />} Create team
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;
};
