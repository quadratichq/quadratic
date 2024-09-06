import { ActionSpecRecord } from '@/app/actions/actionSpec';
import { formatActionsSpec } from '@/app/actions/formatActionsSpec';
import { helpActionsSpec } from '@/app/actions/helpActionsSpec';
import { viewActionsSpec } from '@/app/actions/viewActionsSpec';

export const defaultActionSpec: ActionSpecRecord = {
  ...viewActionsSpec,
  ...formatActionsSpec,
  ...helpActionsSpec,
};
