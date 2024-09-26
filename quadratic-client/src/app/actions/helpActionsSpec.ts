import { isAvailableBecauseLoggedIn } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { openLink } from '@/app/helpers/links';
import { DocumentationIcon, FeedbackIcon, MailIcon } from '@/shared/components/Icons';
import { CONTACT_URL, DOCUMENTATION_URL } from '@/shared/constants/urls';

type HelpActionSpec = Pick<ActionSpecRecord, Action.HelpContactUs | Action.HelpDocs | Action.HelpFeedback>;

export const helpActionsSpec: HelpActionSpec = {
  [Action.HelpContactUs]: {
    label: 'Contact us',
    Icon: MailIcon,
    run: () => {
      openLink(CONTACT_URL);
    },
  },
  [Action.HelpDocs]: {
    label: 'Docs',
    Icon: DocumentationIcon,
    run: () => {
      openLink(DOCUMENTATION_URL);
    },
  },
  [Action.HelpFeedback]: {
    label: 'Feedback',
    Icon: FeedbackIcon,
    isAvailable: isAvailableBecauseLoggedIn,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showFeedbackMenu: true }));
    },
  },
};
