import { requireAuth } from '@/auth/auth';
import { getActionFileDuplicate } from '@/routes/api.files.$uuid';
import { apiClient } from '@/shared/api/apiClient';
import { showFileLimitDialog } from '@/shared/atom/fileLimitDialogAtom';
import { FileLimitDialog } from '@/shared/components/FileLimitDialog';
import { SpinnerIcon } from '@/shared/components/Icons';
import { TeamAvatar } from '@/shared/components/TeamAvatar';
import { UpgradeDialog } from '@/shared/components/UpgradeDialog';
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

type LoaderData = {
  teams: Awaited<ReturnType<typeof apiClient.teams.list>>['teams'];
  fileUuid: string;
  singleTeamUuid?: string;
};

export const loader = async (loaderArgs: LoaderFunctionArgs): Promise<LoaderData | Response> => {
  // You can't duplicate a file if you're not logged in, regardless of your
  // access to the OG file itself.
  await requireAuth(loaderArgs.request);

  const fileUuid = loaderArgs.params.uuid as string;
  const data = await apiClient.teams.list();

  // If the user only has access to one team, check file limit first
  // If over limit, show the UI so user can see the dialog
  if (data.teams.length === 1) {
    const teamUuid = data.teams[0].team.uuid;
    const { isOverLimit, isPaidPlan } = await apiClient.teams.fileLimit(teamUuid, true);

    // If not over limit or on paid plan, duplicate directly
    if (!isOverLimit || isPaidPlan) {
      const { uuid: newFileUuid } = await apiClient.files.duplicate(fileUuid, {
        teamUuid,
        isPrivate: true,
      });
      return redirectDocument(ROUTES.FILE({ uuid: newFileUuid, searchParams: '' }));
    }

    // If over limit, return data so we can show the dialog in the component
    return { teams: data.teams, fileUuid, singleTeamUuid: teamUuid };
  }

  // If there's more than one team, return teams and show ui to pick a team
  return { teams: data.teams, fileUuid };
};

export const Component = () => {
  const { uuid: fileUuid } = useParams() as { uuid: string };
  const { teams, singleTeamUuid } = useLoaderData() as LoaderData;
  const [selectedTeamUuid, setSelectedTeamUuid] = useState<string>(teams[0].team.uuid);
  const navigation = useNavigation();
  const submit = useSubmit();
  const isLoading = useMemo(() => navigation.state !== 'idle', [navigation.state]);

  const doDuplicate = useCallback(
    (teamUuid: string) => {
      const data = getActionFileDuplicate({
        isPrivate: true,
        teamUuid,
        redirect: true,
      });
      submit(data, { method: 'POST', action: ROUTES.API.FILE(fileUuid), encType: 'application/json' });
    },
    [fileUuid, submit]
  );

  const handleSubmit = useCallback(async () => {
    // Check file limit before duplicating
    const { isOverLimit, maxEditableFiles, isPaidPlan } = await apiClient.teams.fileLimit(selectedTeamUuid, true);
    if (isOverLimit && !isPaidPlan) {
      showFileLimitDialog(maxEditableFiles ?? 5, selectedTeamUuid, () => doDuplicate(selectedTeamUuid));
      return;
    }
    doDuplicate(selectedTeamUuid);
  }, [selectedTeamUuid, doDuplicate]);

  // If single team and over limit, show the dialog immediately
  useRemoveInitialLoadingUI();

  // Handle single team over limit case - show dialog on mount
  useMemo(() => {
    if (singleTeamUuid) {
      // We're here because single team was over limit
      // Show the dialog with option to duplicate anyway
      apiClient.teams.fileLimit(singleTeamUuid, true).then(({ maxEditableFiles }) => {
        showFileLimitDialog(maxEditableFiles ?? 5, singleTeamUuid, () => doDuplicate(singleTeamUuid));
      });
    }
  }, [singleTeamUuid, doDuplicate]);

  // For single team over limit, show minimal UI with dialogs
  if (singleTeamUuid) {
    return (
      <div className="flex h-full items-center justify-center">
        <FileLimitDialog />
        <UpgradeDialog teamUuid={singleTeamUuid} canManageBilling={true} />
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Duplicate file</CardTitle>
            <CardDescription>Duplicating to your personal files.</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link to={ROUTES.FILE({ uuid: fileUuid, searchParams: '' })} reloadDocument>
                Back to file
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <FileLimitDialog />
      <UpgradeDialog teamUuid={selectedTeamUuid} canManageBilling={true} />
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
