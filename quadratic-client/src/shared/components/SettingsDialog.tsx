import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { focusGrid } from '@/app/helpers/focusGrid';
import { changelogDialogAtom, showChangelogDialog } from '@/shared/atom/changelogDialogAtom';
import { settingsDialogAtom } from '@/shared/atom/settingsDialogAtom';
import {
  AIIcon,
  CodeIcon,
  CurrencyIcon,
  FilePrivateIcon,
  GroupIcon,
  SheetIcon,
  ThemeIcon,
} from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { VERSION } from '@/shared/constants/appConstants';
import { useChangelogNew } from '@/shared/hooks/useChangelogNew';
import { useTeamData } from '@/shared/hooks/useTeamData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useAtom } from 'jotai';
import { Component, useEffect, useMemo, useState } from 'react';
import { AISettings } from './SettingsTabs/AISettings';
import { DebugSettings } from './SettingsTabs/DebugSettings';
import { FileContentsSettings } from './SettingsTabs/FileContentsSettings';
import { GeneralSettings } from './SettingsTabs/GeneralSettings';
import { TeamAISettings } from './SettingsTabs/TeamAISettings';
import { TeamMembersSettings } from './SettingsTabs/TeamMembersSettings';
import { TeamPrivacySettings } from './SettingsTabs/TeamPrivacySettings';
import { TeamSettings } from './SettingsTabs/TeamSettings';
import { ThemeSettings } from './SettingsTabs/ThemeSettings';

// Error boundary wrapper for TeamSettings
class TeamSettingsErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export function SettingsDialog() {
  const [dialogState, setDialogState] = useAtom(settingsDialogAtom);
  const open = dialogState.open;
  const [activeTab, setActiveTab] = useState('general');
  const [shouldAnimateBadge, setShouldAnimateBadge] = useState(false);
  const [hideChangelogBadge, setHideChangelogBadge] = useState(false);
  const { teamData } = useTeamData();
  const { debugFlags } = useDebugFlags();
  const { hasNewChangelog } = useChangelogNew();
  const hasTeamData = teamData !== null;
  const hasDebugAvailable = debugFlags.debugAvailable;

  // Update active tab when dialog opens with an initial tab
  useEffect(() => {
    if (open && dialogState.initialTab) {
      setActiveTab(dialogState.initialTab);
    } else if (!open) {
      // Reset to general tab when dialog closes
      setActiveTab('general');
    }
  }, [open, dialogState.initialTab]);

  const activeTeamUuid = useMemo(() => {
    return teamData?.activeTeam?.team?.uuid;
  }, [teamData]);

  const classNameIcons = `mx-0.5 text-muted-foreground`;
  const [changelogDialogOpen] = useAtom(changelogDialogAtom);

  // Show the NEW badge if there's a new changelog and we haven't explicitly hidden it
  const showNewBadge = hasNewChangelog && !hideChangelogBadge;

  // Hide badge when changelog dialog opens (changelog is being viewed)
  useEffect(() => {
    if (changelogDialogOpen) {
      setHideChangelogBadge(true);
    }
  }, [changelogDialogOpen]);

  // Reset hide state when dialog closes
  useEffect(() => {
    if (!open) {
      setHideChangelogBadge(false);
    }
  }, [open]);

  // Trigger animation when dialog opens and there's a new changelog badge
  useEffect(() => {
    if (open && showNewBadge) {
      // Wait for dialog animation to complete (~200ms) plus a small delay
      const timer = setTimeout(() => {
        setShouldAnimateBadge(true);
        // Reset animation state after animation completes
        setTimeout(() => setShouldAnimateBadge(false), 2000);
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setShouldAnimateBadge(false);
    }
  }, [open, showNewBadge]);

  const handleOpenChange = (newOpen: boolean) => {
    setDialogState({ open: newOpen });
    if (newOpen) {
      trackEvent('[Settings].opened', {
        team_uuid: activeTeamUuid,
        initial_tab: activeTab,
      });
    } else {
      trackEvent('[Settings].closed', {
        team_uuid: activeTeamUuid,
        final_tab: activeTab,
      });
      setTimeout(() => {
        focusGrid();
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          // Full screen on small screens, dialog on larger screens
          'h-[100vh] max-h-[100vh] w-[100vw] max-w-[100vw] translate-y-0 p-0 sm:h-auto sm:max-h-[calc(100vh-4rem)] sm:max-w-4xl sm:translate-y-3 sm:rounded-lg md:h-[80vh]',
          // Remove default padding since we'll handle it internally
          'gap-0'
        )}
        aria-describedby={undefined}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs
          value={activeTab}
          onValueChange={(newTab) => {
            trackEvent('[Settings].tabChanged', {
              team_uuid: activeTeamUuid,
              from_tab: activeTab,
              to_tab: newTab,
            });
            setActiveTab(newTab);
          }}
          className="flex h-full flex-col overflow-hidden sm:flex-row"
        >
          {/* Left Navigation Pane */}
          <div className="flex-shrink-0 border-b border-border bg-accent sm:w-64 sm:border-b-0 sm:border-r">
            <div className="flex h-full flex-col">
              <div className="w-full px-4 py-3">
                <h2 className="text-lg font-semibold">Settings</h2>
              </div>
              <TabsList className="h-auto flex-col items-start justify-start rounded-none border-0 bg-transparent p-0 sm:w-full">
                <Type
                  as="h3"
                  variant="overline"
                  className="mb-2 mt-1 flex items-baseline justify-between px-4 indent-2 text-muted-foreground"
                >
                  User
                </Type>
                <TabsTrigger
                  value="general"
                  className="flex w-full items-center justify-start gap-2 rounded-none border-b-0 border-l-2 border-transparent px-4 py-2 text-left data-[state=active]:border-l-primary data-[state=active]:bg-background"
                >
                  <SheetIcon className={classNameIcons} />
                  Spreadsheet
                </TabsTrigger>
                <TabsTrigger
                  value="ai"
                  className="flex w-full items-center justify-start gap-2 rounded-none border-b-0 border-l-2 border-transparent px-4 py-2 text-left data-[state=active]:border-l-primary data-[state=active]:bg-background"
                >
                  <AIIcon className={classNameIcons} />
                  AI
                </TabsTrigger>
                <TabsTrigger
                  value="theme"
                  className="flex w-full items-center justify-start gap-2 rounded-none border-b-0 border-l-2 border-transparent px-4 py-2 text-left data-[state=active]:border-l-primary data-[state=active]:bg-background"
                >
                  <ThemeIcon className={classNameIcons} />
                  Theme
                </TabsTrigger>
                {hasTeamData && (
                  <>
                    <Type
                      as="h3"
                      variant="overline"
                      className="mb-2 mt-6 flex items-baseline justify-between px-4 indent-2 text-muted-foreground"
                    >
                      Team
                    </Type>
                    <TabsTrigger
                      value="team"
                      className="flex w-full items-center justify-start gap-2 rounded-none border-b-0 border-l-2 border-transparent px-4 py-2 text-left data-[state=active]:border-l-primary data-[state=active]:bg-background"
                    >
                      <CurrencyIcon className={classNameIcons} />
                      Billing
                    </TabsTrigger>
                    <TabsTrigger
                      value="team-members"
                      className="flex w-full items-center justify-start gap-2 rounded-none border-b-0 border-l-2 border-transparent px-4 py-2 text-left data-[state=active]:border-l-primary data-[state=active]:bg-background"
                    >
                      <GroupIcon className={classNameIcons} />
                      Members
                    </TabsTrigger>
                    <TabsTrigger
                      value="team-ai"
                      className="flex w-full items-center justify-start gap-2 rounded-none border-b-0 border-l-2 border-transparent px-4 py-2 text-left data-[state=active]:border-l-primary data-[state=active]:bg-background"
                    >
                      <AIIcon className={classNameIcons} />
                      AI
                    </TabsTrigger>
                    <TabsTrigger
                      value="team-privacy"
                      className="flex w-full items-center justify-start gap-2 rounded-none border-b-0 border-l-2 border-transparent px-4 py-2 text-left data-[state=active]:border-l-primary data-[state=active]:bg-background"
                    >
                      <FilePrivateIcon className={classNameIcons} />
                      Privacy
                    </TabsTrigger>
                  </>
                )}
                {hasDebugAvailable && (
                  <>
                    <Type
                      as="h3"
                      variant="overline"
                      className="mb-2 mt-6 flex items-baseline justify-between px-4 indent-2 text-muted-foreground"
                    >
                      Debug
                    </Type>
                    <TabsTrigger
                      value="debug"
                      className="flex w-full items-center justify-start gap-2 rounded-none border-b-0 border-l-2 border-transparent px-4 py-2 text-left data-[state=active]:border-l-primary data-[state=active]:bg-background"
                    >
                      <CodeIcon className={classNameIcons} />
                      Debug Flags
                    </TabsTrigger>
                    <TabsTrigger
                      value="file-contents"
                      className="flex w-full items-center justify-start gap-2 rounded-none border-b-0 border-l-2 border-transparent px-4 py-2 text-left data-[state=active]:border-l-primary data-[state=active]:bg-background"
                    >
                      <CodeIcon className={classNameIcons} />
                      File Contents
                    </TabsTrigger>
                  </>
                )}
                {/* Add more tabs here as needed */}
              </TabsList>
              <div className="mt-auto" />
              <div className="border-t border-border px-4 py-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Quadratic</h3>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Version {VERSION}</span>
                    <button
                      onClick={() => {
                        trackEvent('[Settings].changelogClicked', {
                          team_uuid: activeTeamUuid,
                        });
                        showChangelogDialog();
                      }}
                      className="relative text-primary underline hover:text-primary/80"
                    >
                      Changelog
                      {showNewBadge && (
                        <span
                          className={cn(
                            'absolute -right-2 -top-3 rounded-full bg-primary px-1 py-0.5 text-[9px] font-semibold leading-none text-primary-foreground',
                            shouldAnimateBadge && 'animate-badge-pop'
                          )}
                        >
                          NEW
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content Pane */}
          <div className="flex-1 overflow-y-auto bg-background">
            <TabsContent value="general" className="m-0 border-0 p-6 pb-16">
              <GeneralSettings />
            </TabsContent>
            <TabsContent value="ai" className="m-0 border-0 p-6 pb-16">
              <AISettings />
            </TabsContent>
            <TabsContent value="theme" className="m-0 border-0 p-6 pb-16">
              <ThemeSettings />
            </TabsContent>
            {hasTeamData && (
              <>
                <TabsContent value="team" className="m-0 border-0 p-6 pb-16">
                  <TeamSettingsErrorBoundary>
                    <TeamSettings />
                  </TeamSettingsErrorBoundary>
                </TabsContent>
                <TabsContent value="team-members" className="m-0 border-0 p-6 pb-16">
                  <TeamSettingsErrorBoundary>
                    <TeamMembersSettings />
                  </TeamSettingsErrorBoundary>
                </TabsContent>
                <TabsContent value="team-ai" className="m-0 border-0 p-6 pb-16">
                  <TeamSettingsErrorBoundary>
                    <TeamAISettings />
                  </TeamSettingsErrorBoundary>
                </TabsContent>
                <TabsContent value="team-privacy" className="m-0 border-0 p-6 pb-16">
                  <TeamSettingsErrorBoundary>
                    <TeamPrivacySettings />
                  </TeamSettingsErrorBoundary>
                </TabsContent>
              </>
            )}
            {hasDebugAvailable && (
              <>
                <TabsContent value="debug" className="m-0 border-0 p-6 pb-16">
                  <DebugSettings />
                </TabsContent>
                <TabsContent value="file-contents" className="m-0 h-full border-0 p-6 pb-16">
                  <FileContentsSettings />
                </TabsContent>
              </>
            )}
            {/* Add more tab content here as needed */}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
