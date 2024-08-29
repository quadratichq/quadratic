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

const CreateTeamFormSchema = z.object({
  name: TeamSchema.shape.name,
});

export const action = async ({ request }: ActionFunctionArgs) => {
  const data = await request.json();

  try {
    const body = CreateTeamFormSchema.parse(data);
    const { uuid } = await apiClient.teams.create(body);
    return redirect(ROUTES.TEAM(uuid));
  } catch (e) {
    return { ok: false };
  }
};

export const Component = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { teamUuid } = useParams() as { teamUuid: string };
  const [open, setOpen] = useState(true);

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

  const onClose = () => setOpen(false);

  return open ? (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>A team is your collaborative space for working with other people.</DialogDescription>
        </DialogHeader>
        <CreateTeamForm onCancel={onClose} />
      </DialogContent>
    </Dialog>
  ) : null;
};

export const CreateTeamForm = ({ onCancel }: { onCancel?: () => void }) => {
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const fetcher = useFetcher();
  const form = useForm<z.infer<typeof CreateTeamFormSchema>>({
    resolver: zodResolver(CreateTeamFormSchema),
    defaultValues: {
      name: '',
    },
  });

  // Show some UI if the team creation failed
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && fetcher.data.ok === false) {
      addGlobalSnackbar('Failed to create team. Try again', { severity: 'error' });
    }
  }, [fetcher, addGlobalSnackbar]);

  const onSubmit = async (data: z.infer<typeof CreateTeamFormSchema>) => {
    fetcher.submit(data, { action: '/teams/create', method: 'POST', encType: 'application/json' });
  };

  const disabled = fetcher.state !== 'idle';

  return (
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
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant="default" disabled={disabled}>
            {fetcher.state !== 'idle' && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />} Create team
          </Button>
        </div>
      </form>
    </Form>
  );
};
