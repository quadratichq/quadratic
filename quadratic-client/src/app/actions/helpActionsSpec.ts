import { Action } from '@/app/actions/actions';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { DocumentationIcon, FeedbackIcon, MailIcon } from '@/shared/components/Icons';
import { CONTACT_URL, DOCUMENTATION_URL } from '@/shared/constants/urls';

export const helpActionsSpec = {
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
    // isAvailable
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showFeedbackMenu: true }));
    },
  },
};
