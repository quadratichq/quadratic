import { GenericAction } from '@/app/actions/actionTypes';
import { ActionEnum } from '@/app/keyboard/actions';
import { ZoomInIcon } from '@/shared/components/Icons';

export const zoomIn: GenericAction = {
  label: 'Zoom in',
  keyboardShortcut: ActionEnum.enum.zoom_in,
  Icon: ZoomInIcon,
  run: () => {
    // TODO:
  },
};
