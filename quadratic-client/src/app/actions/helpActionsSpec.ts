import { isAvailableBecauseLoggedIn } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import type { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { openLink } from '@/app/helpers/links';
import { showSettingsDialog } from '@/shared/atom/settingsDialogAtom';
import { ExternalLinkIcon, FeedbackIcon, SettingsIcon } from '@/shared/components/Icons';
import { COMMUNITY_FORUMS, CONTACT_URL, DOCUMENTATION_URL, YOUTUBE_CHANNEL } from '@/shared/constants/urls';

type HelpActionSpec = Pick<
  ActionSpecRecord,
  | Action.HelpContactUs
  | Action.HelpDocs
  | Action.HelpFeedback
  | Action.HelpQuadratic101
  | Action.HelpCommunity
  | Action.HelpChangelog
  | Action.HelpSettings
  | Action.HelpYouTube
>;

export const helpActionsSpec: HelpActionSpec = {
  [Action.HelpContactUs]: {
    label: () => 'Contact us',
    Icon: ExternalLinkIcon,
    run: () => {
      openLink(CONTACT_URL);
    },
  },
  [Action.HelpDocs]: {
    label: () => 'Docs',
    labelVerbose: 'Visit docs',
    Icon: ExternalLinkIcon,
    run: () => {
      openLink(DOCUMENTATION_URL);
    },
  },
  [Action.HelpQuadratic101]: {
    label: () => 'Quadratic 101',
    labelVerbose: 'Visit Quadratic 101',
    Icon: ExternalLinkIcon,
    run: () => {
      openLink('https://www.quadratichq.com/quadratic-101');
    },
  },
  [Action.HelpCommunity]: {
    label: () => 'Forum',
    labelVerbose: 'Visit Forum',
    Icon: ExternalLinkIcon,
    run: () => {
      openLink(COMMUNITY_FORUMS);
    },
  },
  [Action.HelpChangelog]: {
    label: () => 'Changelog',
    labelVerbose: 'Visit Changelog',
    Icon: ExternalLinkIcon,
    run: () => {
      openLink('https://www.quadratichq.com/changelog');
    },
  },
  [Action.HelpFeedback]: {
    label: () => 'Feedback',
    labelVerbose: 'Provide feedback',
    Icon: FeedbackIcon,
    isAvailable: isAvailableBecauseLoggedIn,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showFeedbackMenu: true }));
    },
  },
  [Action.HelpSettings]: {
    label: () => 'Settings',
    labelVerbose: 'Open settings',
    Icon: SettingsIcon,
    run: () => {
      showSettingsDialog();
    },
  },
  [Action.HelpYouTube]: {
    label: () => 'YouTube',
    labelVerbose: 'Visit our YouTube channel',
    Icon: ExternalLinkIcon,
    run: () => {
      openLink(YOUTUBE_CHANNEL);
    },
  },
};
