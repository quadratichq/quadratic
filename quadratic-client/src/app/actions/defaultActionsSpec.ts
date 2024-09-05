import { ActionSpecRecord } from '@/app/actions/actionSpec';
import { viewActionsSpec } from '@/app/actions/viewActionsSpec';

export const defaultActionSpec: ActionSpecRecord = {
  ...viewActionsSpec,
};
