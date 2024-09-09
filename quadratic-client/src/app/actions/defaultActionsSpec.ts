import { ActionSpecRecord } from '@/app/actions/actionSpec';
import { editActionsSpec } from '@/app/actions/editActionsSpec';
import { formatActionsSpec } from '@/app/actions/formatActionsSpec';
import { helpActionsSpec } from '@/app/actions/helpActionsSpec';
import { viewActionsSpec } from '@/app/actions/viewActionsSpec';

export const defaultActionSpec: ActionSpecRecord = {
  ...editActionsSpec,
  ...viewActionsSpec,
  ...formatActionsSpec,
  ...helpActionsSpec,
};
