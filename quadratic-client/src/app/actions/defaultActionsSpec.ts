import type { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { codeActionsSpec } from '@/app/actions/codeActionsSpec';
import { columnRowSpec } from '@/app/actions/columnRowSpec';
import { dataTableSpec } from '@/app/actions/dataTableSpec';
import { editActionsSpec } from '@/app/actions/editActionsSpec';
import { fileActionsSpec } from '@/app/actions/fileActionsSpec';
import { formatActionsSpec } from '@/app/actions/formatActionsSpec';
import { helpActionsSpec } from '@/app/actions/helpActionsSpec';
import { insertActionsSpec } from '@/app/actions/insertActionsSpec';
import { selectionActionsSpec } from '@/app/actions/selectionActionsSpec';
import { viewActionsSpec } from '@/app/actions/viewActionsSpec';

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
