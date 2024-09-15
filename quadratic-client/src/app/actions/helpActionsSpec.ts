import { isAvailableBecauseLoggedIn } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { DocumentationIcon, FeedbackIcon, MailIcon } from '@/shared/components/Icons';
import { CONTACT_URL, DOCUMENTATION_URL } from '@/shared/constants/urls';

type HelpActionSpec = Pick<ActionSpecRecord, Action.HelpContactUs | Action.HelpDocs | Action.HelpFeedback>;

export const helpActionsSpec: HelpActionSpec = {
  [Action.HelpContactUs]: {
    label: 'Contact us',
    Icon: MailIcon,
    run: () => {
      window.open(CONTACT_URL, '_blank', 'noreferrer,noopener');
    },
  },
  [Action.HelpDocs]: {
    label: 'Docs',
    Icon: DocumentationIcon,
    run: () => {
      window.open(DOCUMENTATION_URL, '_blank', 'noreferrer,noopener');
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
