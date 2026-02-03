import { useFileImport } from '@/app/ui/hooks/useFileImport';
import Logo from '@/dashboard/components/quadratic-logo.svg';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import type { TeamAction } from '@/routes/teams.$teamUuid';
import { apiClient } from '@/shared/api/apiClient';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { ROUTES } from '@/shared/constants/routes';
import { CONTACT_URL, DOCUMENTATION_URL } from '@/shared/constants/urls';
import { useNewFileFromStatePythonApi } from '@/shared/hooks/useNewFileFromState';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import {
  ArrowDownIcon,
  CheckCircledIcon,
  CircleIcon,
  Cross1Icon,
  MixIcon,
  PlusIcon,
  RocketIcon,
} from '@radix-ui/react-icons';
import * as Tabs from '@radix-ui/react-tabs';
import { UserTeamRoleSchema } from 'quadratic-shared/typesAndSchemas';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSubmit } from 'react-router';
import { z } from 'zod';

export function OnboardingBanner() {
  const {
    activeTeam: {
      team: { uuid: teamUuid },
      clientDataKv,
      connections,
      files,
      users,
      invites,
      userMakingRequest: { teamPermissions },
    },
  } = useDashboardRouteLoaderData();
  const handleFileImport = useFileImport();
  const onClickImport = () => {
    trackEvent('[OnboardingBanner].newFileFromImport');
    handleFileImport({ isPrivate: true, teamUuid });
  };
  const newApiFileToLink = useNewFileFromStatePythonApi({ isPrivate: true, teamUuid });

  // Only show the banner to people who can 1) write to the team, and 2) haven't dismissed it yet
  const initialValueOfShowBanner = teamPermissions.includes('TEAM_EDIT') && !clientDataKv.onboardingBannerDismissed;
  const [showBanner, setShowBanner] = useState(initialValueOfShowBanner);
  // If the user switches teams, reset the banner's visibility
  useEffect(() => {
    setShowBanner(initialValueOfShowBanner);
  }, [initialValueOfShowBanner]);

  const trackCreateConnection = () => {
    trackEvent('[OnboardingBanner].createConnection');
  };
  const tabContentClassName = 'flex flex-col gap-2';
  const contentBtnClassName = 'min-w-40 flex-shrink-0';

  const handleCreateBlankFile = () => {
    trackEvent('[OnboardingBanner].newFileBlank');
    // Onboarding creates team files (not private)
    window.location.href = ROUTES.CREATE_FILE(teamUuid);
  };

  const handleFetchFromApi = () => {
    trackEvent('[OnboardingBanner].newFileFromApi');
    // Onboarding creates team files (not private)
    window.location.href = newApiFileToLink;
  };

  const tabs = [
    {
      label: 'Create a file',
      completed: files.length > 0,
      content: (
        <>
          <p>Start with one of our files:</p>
          <div className="mb-2 flex gap-2">
            <Button variant="outline" className={contentBtnClassName} onClick={handleCreateBlankFile}>
              <PlusIcon className="mr-1" /> Create blank file
            </Button>

            <Button variant="outline" className={contentBtnClassName} asChild>
              <Link
                to={ROUTES.TEMPLATES}
                onClick={() => {
                  trackEvent('[OnboardingBanner].newFileFromExample');
                }}
              >
                <MixIcon className="mr-1" /> Explore templates
              </Link>
            </Button>
          </div>
          <p>Or bring your own data:</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleFetchFromApi}>
              <RocketIcon className="mr-1" /> Fetch data from an API
            </Button>
            <Button variant="outline" onClick={onClickImport}>
              <ArrowDownIcon className="mr-1" /> Import CSV, Excel, or Parquet file
            </Button>
          </div>
        </>
      ),
    },
    {
      label: 'Create a connection',
      completed: connections.filter((c) => !c.isDemo).length > 0,
      content: (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Button variant="outline" className="w-full gap-2 whitespace-nowrap" asChild>
            <Link to={ROUTES.TEAM_CONNECTION_CREATE(teamUuid, 'GOOGLE_ANALYTICS')} onClick={trackCreateConnection}>
              <LanguageIcon language="GOOGLE_ANALYTICS" /> Google Analytics
            </Link>
          </Button>
          <Button variant="outline" className="w-full gap-2 whitespace-nowrap" asChild>
            <Link to={ROUTES.TEAM_CONNECTION_CREATE(teamUuid, 'MIXPANEL')} onClick={trackCreateConnection}>
              <LanguageIcon language="MIXPANEL" /> Mixpanel
            </Link>
          </Button>
          <Button variant="outline" className="w-full gap-2 whitespace-nowrap" asChild>
            <Link to={ROUTES.TEAM_CONNECTION_CREATE(teamUuid, 'PLAID')} onClick={trackCreateConnection}>
              <LanguageIcon language="PLAID" /> Bank accounts
            </Link>
          </Button>
          <Button variant="outline" className="w-full gap-2 whitespace-nowrap" asChild>
            <Link to={ROUTES.TEAM_CONNECTION_CREATE(teamUuid, 'POSTGRES')} onClick={trackCreateConnection}>
              <LanguageIcon language="POSTGRES" /> Postgres
            </Link>
          </Button>
          <Button variant="outline" className="w-full gap-2 whitespace-nowrap" asChild>
            <Link to={ROUTES.TEAM_CONNECTION_CREATE(teamUuid, 'MYSQL')} onClick={trackCreateConnection}>
              <LanguageIcon language="MYSQL" /> MySQL
            </Link>
          </Button>
          <Button variant="outline" className="w-full gap-2 whitespace-nowrap" asChild>
            <Link to={ROUTES.TEAM_CONNECTION_CREATE(teamUuid, 'SNOWFLAKE')} onClick={trackCreateConnection}>
              <LanguageIcon language="SNOWFLAKE" /> Snowflake
            </Link>
          </Button>
          <Button variant="outline" className="w-full gap-2 whitespace-nowrap" asChild>
            <Link to={ROUTES.TEAM_CONNECTION_CREATE(teamUuid, 'BIGQUERY')} onClick={trackCreateConnection}>
              <LanguageIcon language="BIGQUERY" /> BigQuery
            </Link>
          </Button>
          <Button variant="outline" className="w-full gap-2 whitespace-nowrap" asChild>
            <Link to={ROUTES.TEAM_CONNECTIONS_NEW(teamUuid)} onClick={trackCreateConnection}>
              View all…
            </Link>
          </Button>
        </div>
      ),
    },
    {
      label: 'Invite teammates',
      completed: users.length > 1 || invites.length > 0,
      content: (
        <>
          <p>Invite a collaborator to Quadratic.</p>

          <InviteForm teamUuid={teamUuid} />
          <p className="text-muted-foreground">
            You can always{' '}
            <Link to={ROUTES.TEAM_MEMBERS(teamUuid)} className="underline hover:text-primary">
              manage your team members
            </Link>{' '}
            at any time.
          </p>
        </>
      ),
    },
  ];

  // Set the tab based on which item is incomplete
  const firstCompletedIndex = tabs.findIndex(({ completed }) => !completed);
  const [activeTabIndex, setActiveTabIndex] = useState(String(firstCompletedIndex === -1 ? 0 : firstCompletedIndex));
  const tasksCount = tabs.length;
  const tasksCompletedCount = tabs.filter(({ completed }) => completed).length;

  // Immediately hide the UI then persist the dismissal to the server
  const handleDismiss = () => {
    trackEvent('[OnboardingBanner].dismiss');
    setShowBanner(false);
    apiClient.teams.update(teamUuid, { clientDataKv: { onboardingBannerDismissed: true } });
  };

  return showBanner ? (
    <div className="relative mt-3 hidden rounded-md border border-input px-4 py-3 shadow-sm md:flex md:flex-col">
      <Button
        variant="link"
        size="icon"
        className="absolute right-0.5 top-0.5 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
        onClick={() => {
          handleDismiss();
        }}
      >
        <Cross1Icon />
      </Button>

      <div className="flex items-center gap-4 border-b border-border pb-3">
        <img src={Logo} width="24" height="35" alt="Quadratic logo" />
        <div className="flex flex-col">
          <h3 className="text-md font-medium leading-6 tracking-tight">Getting started with your team</h3>
          <p className="text-sm text-muted-foreground">
            <strong className={cn('font-semibold', tasksCompletedCount === tasksCount && 'text-success')}>
              {tasksCompletedCount} of {tasksCount} complete
            </strong>{' '}
            ·{' '}
            {tasksCompletedCount === tasksCount ? (
              <Button onClick={handleDismiss} variant="link" className="h-auto p-0 text-inherit underline">
                Dismiss
              </Button>
            ) : (
              <>
                Need help?{' '}
                <a href={DOCUMENTATION_URL} target="_blank" rel="noreferrer" className="underline hover:text-primary">
                  Read the docs
                </a>{' '}
                or{' '}
                <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="underline hover:text-primary">
                  contact us
                </a>
                , we’d love to hear from you.
              </>
            )}
          </p>
        </div>
      </div>
      <Tabs.Root
        value={activeTabIndex}
        onValueChange={(newActiveTab) => setActiveTabIndex(newActiveTab)}
        className="grid grid-cols-[14rem_1fr] text-sm"
      >
        <Tabs.List className="flex flex-col gap-[1px] border-r border-border pr-4 pt-2">
          {tabs.map(({ label, completed }, index) => (
            <Tabs.Trigger
              key={index}
              value={String(index)}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded px-2 ring-offset-background transition-all hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-accent',
                completed && 'text-success'
              )}
            >
              {completed ? (
                <CheckCircledIcon className="text-success" />
              ) : (
                <CircleIcon className="text-muted-foreground opacity-30" />
              )}
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className="py-3 pl-4">
          {tabs.map(({ content }, index) => (
            <Tabs.Content key={index} value={String(index)} className={tabContentClassName}>
              {content}
            </Tabs.Content>
          ))}
        </div>
      </Tabs.Root>
    </div>
  ) : null;
}

function InviteForm({ teamUuid }: { teamUuid: string }) {
  const [error, setError] = useState('');
  const [invited, setInvited] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmit();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Get the data from the form
    const formData = new FormData(e.currentTarget);
    const emailFromUser = String(formData.get('email_search')).trim();

    // Validate email
    let email;
    try {
      email = z.string().email().parse(emailFromUser);
    } catch (e) {
      setError('Invalid email');
      return;
    }

    // Submit the data
    const data: TeamAction['request.create-team-invite'] = {
      intent: 'create-team-invite',
      email: email,
      role: UserTeamRoleSchema.enum.EDITOR,
    };
    submit(data, { method: 'POST', action: ROUTES.TEAM(teamUuid), encType: 'application/json', navigate: false });

    // UI feedback that it was sent
    setInvited(true);
    setTimeout(() => {
      setInvited(false);
    }, 3000);

    // Track it
    trackEvent('[OnboardingBanner].inviteSent');

    // Reset the email input & focus it
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  };

  return (
    <form className="mb-1 max-w-96 gap-2 text-sm" onSubmit={onSubmit}>
      <div className="flex gap-2">
        <Input
          autoComplete="off"
          spellCheck="false"
          aria-label="Email"
          // We have to put the `search` in the name because Safari
          // https://bytes.grubhub.com/disabling-safari-autofill-for-a-single-line-address-input-b83137b5b1c7
          name="email_search"
          autoFocus
          ref={inputRef}
          onChange={(e) => {
            setError('');
          }}
          placeholder="your_coworker@company.com"
        />
        <Button type="submit" variant="outline">
          Invite
        </Button>
      </div>
      <p className={cn('mt-1 text-xs', invited && 'text-success', error && 'text-destructive')}>
        {invited ? 'Invite sent!' : error ? error : <>&nbsp;</>}
      </p>
    </form>
  );
}
