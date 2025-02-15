import { isAvailableBecauseLoggedIn } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import type { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { openLink } from '@/app/helpers/links';
import { ExternalLinkIcon, FeedbackIcon } from '@/shared/components/Icons';
import { CONTACT_URL, DOCUMENTATION_URL } from '@/shared/constants/urls';

type HelpActionSpec = Pick<
  ActionSpecRecord,
  | Action.HelpContactUs
  | Action.HelpDocs
  | Action.HelpFeedback
  | Action.HelpQuadratic101
  | Action.HelpCommunity
  | Action.HelpChangelog
>;

export const helpActionsSpec: HelpActionSpec = {
  [Action.HelpContactUs]: {
    label: 'Contact us',
    Icon: ExternalLinkIcon,
    run: () => {
      openLink(CONTACT_URL);
    },
  },
  [Action.HelpDocs]: {
    label: 'Docs',
    labelVerbose: 'Visit docs',
    Icon: ExternalLinkIcon,
    run: () => {
      openLink(DOCUMENTATION_URL);
    },
  },
  [Action.HelpQuadratic101]: {
    label: 'Quadratic 101',
    labelVerbose: 'Visit Quadratic 101',
    Icon: ExternalLinkIcon,
    run: () => {
      openLink('https://www.quadratichq.com/quadratic-101');
    },
  },
  [Action.HelpCommunity]: {
    label: 'Community',
    labelVerbose: 'Visit Community',
    Icon: ExternalLinkIcon,
    run: () => {
      openLink('https://www.quadratichq.com/quadratic-101');
    },
  },
  [Action.HelpChangelog]: {
    label: 'Changelog',
    labelVerbose: 'Visit Changelog',
    Icon: ExternalLinkIcon,
    run: () => {
      openLink('https://www.quadratichq.com/changelog');
    },
  },
  [Action.HelpFeedback]: {
    label: 'Feedback',
    labelVerbose: 'Provide feedback',
    Icon: FeedbackIcon,
    isAvailable: isAvailableBecauseLoggedIn,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showFeedbackMenu: true }));
    },
  },
};
