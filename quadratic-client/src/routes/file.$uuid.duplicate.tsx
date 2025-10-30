import { requireAuth } from '@/auth/auth';
import { getActionFileDuplicate } from '@/routes/api.files.$uuid';
import { apiClient } from '@/shared/api/apiClient';
import { SpinnerIcon } from '@/shared/components/Icons';
import { TeamAvatar } from '@/shared/components/TeamAvatar';
import { ROUTES } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/shadcn/ui/card';
import { Label } from '@/shared/shadcn/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/shadcn/ui/radio-group';
import { cn } from '@/shared/shadcn/utils';
import { useCallback, useMemo, useState } from 'react';
import {
  Link,
  redirectDocument,
  useLoaderData,
  useNavigation,
  useParams,
  useSubmit,
  type LoaderFunctionArgs,
} from 'react-router';

export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  // You can't duplicate a file if you're not logged in, regardless of your
  // access to the OG file itself.
  await requireAuth();

  const fileUuid = loaderArgs.params.uuid as string;
  const data = await apiClient.teams.list();

  // If the user only has access to one team, just duplicate the file and
  // send them on their way.
  if (data.teams.length === 1) {
    const { uuid: newFileUuid } = await apiClient.files.duplicate(fileUuid, {
      teamUuid: data.teams[0].team.uuid,
      isPrivate: true,
    });
    return redirectDocument(ROUTES.FILE({ uuid: newFileUuid, searchParams: '' }));
  }

  // If there's more than one team, return teams and show ui to pick a team
  return data;
};

export const Component = () => {
  const { uuid: fileUuid } = useParams() as { uuid: string };
  const { teams } = useLoaderData() as Exclude<Awaited<ReturnType<typeof loader>>, Response>;
  const [selectedTeamUuid, setSelectedTeamUuid] = useState<string>(teams[0].team.uuid);
  const navigation = useNavigation();
  const submit = useSubmit();
  const isLoading = useMemo(() => navigation.state !== 'idle', [navigation.state]);

  const handleSubmit = useCallback(() => {
    const data = getActionFileDuplicate({
      isPrivate: true,
      teamUuid: selectedTeamUuid,
      redirect: true,
    });
    submit(data, { method: 'POST', action: ROUTES.API.FILE(fileUuid), encType: 'application/json' });
  }, [fileUuid, selectedTeamUuid, submit]);

  useRemoveInitialLoadingUI();

  return (
    <div className="flex h-full items-center justify-center">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Duplicate file</CardTitle>
          <CardDescription>Choose a team, the file will be duplicated to your personal files.</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <RadioGroup value={selectedTeamUuid} onValueChange={setSelectedTeamUuid} className="gap-0">
              {teams.map((team) => (
                <Label
                  htmlFor={team.team.uuid}
                  key={team.team.uuid}
                  className="flex w-full items-center gap-2 rounded p-3 has-[[aria-checked=true]]:bg-accent"
                >
                  <TeamAvatar name={team.team.name} />
                  {team.team.name}

                  <RadioGroupItem value={team.team.uuid} id={team.team.uuid} className="ml-auto" />
                </Label>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <SpinnerIcon className={cn('mr-auto text-muted-foreground', isLoading ? 'opacity-100' : 'opacity-0')} />
          <Button variant="outline" disabled={isLoading} asChild>
            <Link to={ROUTES.FILE({ uuid: fileUuid, searchParams: '' })} reloadDocument>
              Back to file
            </Link>
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            Duplicate
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

// Note: there is no action for this route. Where necessary, we re-use the
// existing action from the `api.files.$uuid` route that's used on the dashboard.
