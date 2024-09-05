import { Action } from '@/app/actions/actions';
import { ActionSpecRecord } from '@/app/actions/actionSpec';
import { ZoomInIcon } from '@/shared/components/Icons';

export const viewActionsSpec: ActionSpecRecord = {
  [Action.ZoomIn]: {
    label: 'Zoom in',
    Icon: ZoomInIcon,
    run: () => {
      // TODO:
    },
  },
};
