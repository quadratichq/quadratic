import { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { codeActionsSpec } from '@/app/actions/codeActionsSpec';
import { editActionsSpec } from '@/app/actions/editActionsSpec';
import { fileActionsSpec } from '@/app/actions/fileActionsSpec';
import { formatActionsSpec } from '@/app/actions/formatActionsSpec';
import { helpActionsSpec } from '@/app/actions/helpActionsSpec';
import { insertActionsSpec } from '@/app/actions/insertActionsSpec';
import { selectionActionsSpec } from '@/app/actions/selectionActionsSpec';
import { viewActionsSpec } from '@/app/actions/viewActionsSpec';
import { columnRowSpec } from './columnRowSpec';
import { dataTableSpec } from './dataTableSpec';

export const defaultActionSpec: ActionSpecRecord = {
  ...fileActionsSpec,
  ...editActionsSpec,
  ...viewActionsSpec,
  ...insertActionsSpec,
  ...formatActionsSpec,
  ...helpActionsSpec,
  ...selectionActionsSpec,
  ...codeActionsSpec,
  ...columnRowSpec,
  ...dataTableSpec,
};
