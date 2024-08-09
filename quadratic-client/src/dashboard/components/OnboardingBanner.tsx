import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import Logo from '@/dashboard/components/quadratic-logo.svg';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { ROUTES } from '@/shared/constants/routes';
import { CONTACT_URL, DOCUMENTATION_URL } from '@/shared/constants/urls';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { CheckCircledIcon, CircleIcon, Cross1Icon } from '@radix-ui/react-icons';
import * as Tabs from '@radix-ui/react-tabs';
import { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

const TAB_CREATE_SHEET = '1';
const TAB_CREATE_CONNECTION = '2';
const TAB_INVITE_TEAM_MEMBER = '3';

export function OnboardingBanner() {
  const {
    activeTeam: { files, filesPrivate, users, invites },
  } = useDashboardRouteLoaderData();
  const { teamUuid } = useParams() as { teamUuid: string };
  const tabContentClassName = 'flex flex-col gap-2';
  const contentBtnClassName = 'min-w-44';
  const [activeTab, setActiveTab] = useLocalStorage('OnboardingBanner', TAB_CREATE_SHEET);

  const completeCreateSheet = files.length > 0 || filesPrivate.length > 0;
  const completeInviteTeam = users.length > 1 || invites.length > 0;
  const completeCreateConnection = false;
  const completions = [completeCreateSheet, completeInviteTeam, completeCreateConnection];
  // TODO: connection

  // If the above are complete, mark this as done (as a user pref?) and don't show it again

  return (
    <div className="relative mt-3 flex flex-col rounded-md border border-input px-4 py-3 shadow-sm">
      <div className="flex items-center gap-4 border-b border-border pb-3">
        <img src={Logo} width="24" height="35" alt="Quadratic logo" />
        <div className="flex flex-col">
          <h3 className="text-md font-medium leading-6 tracking-tight">Getting started with Quadratic</h3>
          <p className="text-sm text-muted-foreground">
            <strong className="font-semibold">{completions.filter(Boolean).length} of 3 complete</strong> · Need help?{' '}
            <a href={DOCUMENTATION_URL} target="_blank" rel="noreferrer" className="underline hover:text-primary">
              Read the docs
            </a>{' '}
            or{' '}
            <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="underline hover:text-primary">
              contact us
            </a>
            , we love hearing from folks.
          </p>
        </div>
      </div>
      <Tabs.Root
        value={activeTab}
        onValueChange={(newActiveTab) => setActiveTab(newActiveTab)}
        className="grid grid-cols-[14rem_1fr] text-sm"
      >
        <Tabs.List className="flex flex-col gap-[1px] border-r border-border pr-4 pt-2">
          <TabTrigger value={TAB_CREATE_SHEET} completed={completeCreateSheet}>
            Create a sheet
          </TabTrigger>
          <TabTrigger value={TAB_CREATE_CONNECTION} completed={false}>
            Create a connection
          </TabTrigger>
          <TabTrigger value={TAB_INVITE_TEAM_MEMBER} completed={completeInviteTeam}>
            Invite teammates
          </TabTrigger>
        </Tabs.List>

        <div className="py-3 pl-4">
          <Tabs.Content value={TAB_CREATE_SHEET} className={tabContentClassName}>
            <p>
              Start with a blank file, one of our example files, or by importing your own data from a file, an API, or
              an external data source.
            </p>
            <p>
              <Button asChild variant="outline" className={contentBtnClassName}>
                <Link to={ROUTES.CREATE_FILE(teamUuid)}>Create new file</Link>
              </Button>
            </p>
          </Tabs.Content>
          <Tabs.Content value={TAB_CREATE_CONNECTION} className={tabContentClassName}>
            <p>Connect to an external data source and pull your data into Quadratic.</p>
            <div className="flex gap-2">
              <Button variant="outline" className={contentBtnClassName + ' gap-2'}>
                <LanguageIcon language="MYSQL" /> MySQL
              </Button>
              <Button variant="outline" className={contentBtnClassName + ' gap-2'}>
                <LanguageIcon language="POSTGRES" /> Postgres
              </Button>
            </div>
          </Tabs.Content>
          <Tabs.Content value={TAB_INVITE_TEAM_MEMBER} className={tabContentClassName}>
            <p>
              Quadratic is best with other people. Invite others and collaborate in real-time on your data analyses.
            </p>
            <div>
              <Button asChild variant="outline" className={contentBtnClassName}>
                <Link to={ROUTES.TEAM_MEMBERS(teamUuid)}>Invite people</Link>
              </Button>
            </div>
          </Tabs.Content>
        </div>
      </Tabs.Root>
      <Button
        variant="link"
        size="icon"
        className="absolute right-0.5 top-0.5 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <Cross1Icon />
      </Button>
    </div>
  );
}

function TabTrigger({ completed, value, children }: { completed: boolean; value: string; children: ReactNode }) {
  const tabClassName = cn(
    'inline-flex gap-2 h-9 items-center hover:bg-accent px-2 rounded ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-accent',
    completed && 'text-success'
  );
  return (
    <Tabs.Trigger value={value} className={tabClassName}>
      {completed ? (
        <CheckCircledIcon className="text-success" />
      ) : (
        <CircleIcon className="text-muted-foreground opacity-50" />
      )}{' '}
      {children}
    </Tabs.Trigger>
  );
}
