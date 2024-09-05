import { Action } from '@/app/actions/actions';
import { GenericAction } from '@/app/actions/actionTypes';
import { ZoomInIcon } from '@/shared/components/Icons';

export const zoomIn: GenericAction = {
  label: 'Zoom in',
  keyboardShortcut: Action.ZoomIn,
  Icon: ZoomInIcon,
  run: () => {
    // TODO:
  },
};
