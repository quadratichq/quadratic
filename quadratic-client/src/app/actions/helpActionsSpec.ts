import { Action } from '@/app/actions/actions';
import { ActionSpecRecord } from '@/app/actions/actionSpec';
import { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { DocumentationIcon, FeedbackIcon, MailIcon } from '@/shared/components/Icons';
import { CONTACT_URL, DOCUMENTATION_URL } from '@/shared/constants/urls';
import { SetterOrUpdater } from 'recoil';

export const helpActionsSpec: ActionSpecRecord = {
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
    run: ({ setEditorInteractionState }: { setEditorInteractionState: SetterOrUpdater<EditorInteractionState> }) => {
      setEditorInteractionState((prev) => ({ ...prev, showFeedbackMenu: true }));
    },
  },
};
