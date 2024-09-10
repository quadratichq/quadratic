import { Action } from '@/app/actions/actions';
import { zoomIn, zoomInOut, zoomOut, zoomToFit, zoomToSelection } from '@/app/gridGL/helpers/zoom';

export const viewActionsSpec = {
  [Action.ZoomIn]: {
    label: 'Zoom in',
    run: () => {
      zoomIn();
    },
  },
  [Action.ZoomOut]: {
    label: 'Zoom out',
    run: () => {
      zoomOut();
    },
  },
  [Action.ZoomToSelection]: {
    label: 'Zoom to selection',
    run: () => {
      zoomToSelection();
    },
  },
  [Action.ZoomToFit]: {
    label: 'Zoom to fit',
    run: () => {
      zoomToFit();
    },
  },
  [Action.ZoomTo50]: {
    label: 'Zoom to 50%',
    run: () => {
      zoomInOut(0.5);
    },
  },
  [Action.ZoomTo100]: {
    label: 'Zoom to 100%',
    run: () => {
      zoomInOut(1);
    },
  },
  [Action.ZoomTo200]: {
    label: 'Zoom to 200%',
    run: () => {
      zoomInOut(2);
    },
  },
};
