import { AddDataTable } from '@/app/ai/toolCards/AddDataTable';
import { AddDateTimeValidation } from '@/app/ai/toolCards/AddDateTimeValidation';
import { AddListValidation } from '@/app/ai/toolCards/AddListValidation';
import { AddLogicalValidation } from '@/app/ai/toolCards/AddLogicalValidations';
import { AddMessage } from '@/app/ai/toolCards/AddMessage';
import { AddNumberValidation } from '@/app/ai/toolCards/AddNumberValidation';
import { AddTextValidation } from '@/app/ai/toolCards/AddTextValidation';
import { ColorSheets } from '@/app/ai/toolCards/ColorSheets';
import { ContactUs } from '@/app/ai/toolCards/ContactUs';
import { ConvertToTable } from '@/app/ai/toolCards/ConvertToTable';
import { NewSheet } from '@/app/ai/toolCards/CreateNewSheet';
import { DeleteCells } from '@/app/ai/toolCards/DeleteCells';
import { DeleteColumns } from '@/app/ai/toolCards/DeleteColumns';
import { DeleteRows } from '@/app/ai/toolCards/DeleteRows';
import { DeleteSheet } from '@/app/ai/toolCards/DeleteSheet';
import { DuplicateSheet } from '@/app/ai/toolCards/DuplicateSheet';
import { GetCellData } from '@/app/ai/toolCards/GetCellData';
import { GetCodeCellValue } from '@/app/ai/toolCards/GetCodeCellValue';
import { GetConditionalFormats } from '@/app/ai/toolCards/GetConditionalFormats';
import { GetDatabaseSchemas } from '@/app/ai/toolCards/GetDatabaseSchemas';
import { GetTextFormats } from '@/app/ai/toolCards/GetTextFormats';
import { IndexDataSource } from '@/app/ai/toolCards/IndexDataSource';
import { GetValidations } from '@/app/ai/toolCards/GetValidations';
import { HasCellData } from '@/app/ai/toolCards/HasCellData';
import { InsertColumns } from '@/app/ai/toolCards/InsertColumns';
import { InsertRows } from '@/app/ai/toolCards/InsertRows';
import { MergeCells } from '@/app/ai/toolCards/MergeCells';
import { MoveCells } from '@/app/ai/toolCards/MoveCells';
import { MoveSheet } from '@/app/ai/toolCards/MoveSheet';
import { PDFImport } from '@/app/ai/toolCards/PDFImport';
import { Redo } from '@/app/ai/toolCards/Redo';
import { RemoveValidations } from '@/app/ai/toolCards/RemoveValidations';
import { RenameSheet } from '@/app/ai/toolCards/RenameSheet';
import { RerunCode } from '@/app/ai/toolCards/RerunCode';
import { ResizeColumns } from '@/app/ai/toolCards/ResizeColumns';
import { ResizeRows } from '@/app/ai/toolCards/ResizeRows';
import { SetBorders } from '@/app/ai/toolCards/SetBorders';
import { SetCellValues } from '@/app/ai/toolCards/SetCellValues';
import { SetCodeCellValue } from '@/app/ai/toolCards/SetCodeCellValue';
import { SetFormulaCellValue } from '@/app/ai/toolCards/SetFormulaCellValue';
import { SetSQLCodeCellValue } from '@/app/ai/toolCards/SetSQLCodeCellValue';
import { SetTextFormats } from '@/app/ai/toolCards/SetTextFormats';
import { TableColumnSettings } from '@/app/ai/toolCards/TableColumnSettings';
import { TableMeta } from '@/app/ai/toolCards/TableMeta';
import { TextSearch } from '@/app/ai/toolCards/TextSearch';
import { Undo } from '@/app/ai/toolCards/Undo';
import { UnmergeCells } from '@/app/ai/toolCards/UnmergeCells';
import { UpdateCodeCell } from '@/app/ai/toolCards/UpdateCodeCell';
import { UpdateConditionalFormats } from '@/app/ai/toolCards/UpdateConditionalFormats';
import { UserPromptSuggestionsSkeleton } from '@/app/ai/toolCards/UserPromptSuggestionsSkeleton';
import { WebSearch } from '@/app/ai/toolCards/WebSearch';
import { cn } from '@/shared/shadcn/utils';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo } from 'react';

type AIToolCardProps = {
  toolCall: AIToolCall;
  className?: string;
  isUpdate?: boolean; // For code tools: true if this is updating an existing cell
  hideIcon?: boolean; // Hide icon when nested in a group
};

export const AIToolCard = memo(({ toolCall, className, isUpdate, hideIcon }: AIToolCardProps) => {
  if (!Object.values(AITool).includes(toolCall.name as AITool)) {
    return null;
  }

  switch (toolCall.name) {
    case AITool.AddDataTable:
      return <AddDataTable toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.SetCellValues:
      return <SetCellValues toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.GetCodeCellValue:
      return <GetCodeCellValue toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.SetCodeCellValue:
      return (
        <SetCodeCellValue
          toolCall={toolCall}
          className={cn('tool-card', className)}
          isUpdate={isUpdate}
          hideIcon={hideIcon}
        />
      );
    case AITool.GetDatabaseSchemas:
      return <GetDatabaseSchemas toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.IndexDataSource:
      return <IndexDataSource toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.SetSQLCodeCellValue:
      return <SetSQLCodeCellValue toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.SetFormulaCellValue:
      return <SetFormulaCellValue toolCall={toolCall} className={cn('tool-card', className)} hideIcon={hideIcon} />;
    case AITool.MoveCells:
      return <MoveCells toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.DeleteCells:
      return <DeleteCells toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.UpdateCodeCell:
      return <UpdateCodeCell toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.UserPromptSuggestions:
      return <UserPromptSuggestionsSkeleton toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.PDFImport:
      return <PDFImport toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.GetCellData:
      return <GetCellData toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.SetTextFormats:
      return <SetTextFormats toolCall={toolCall} className={cn('tool-card', className)} hideIcon={hideIcon} />;
    case AITool.GetTextFormats:
      return <GetTextFormats toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.ConvertToTable:
      return <ConvertToTable toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.WebSearch:
      return <WebSearch toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.AddSheet:
      return <NewSheet toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.DuplicateSheet:
      return <DuplicateSheet toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.RenameSheet:
      return <RenameSheet toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.DeleteSheet:
      return <DeleteSheet toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.MoveSheet:
      return <MoveSheet toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.ColorSheets:
      return <ColorSheets toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.TextSearch:
      return <TextSearch toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.HasCellData:
      return <HasCellData toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.RerunCode:
      return <RerunCode toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.ResizeColumns:
      return <ResizeColumns toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.ResizeRows:
      return <ResizeRows toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.SetBorders:
      return <SetBorders toolCall={toolCall} className={cn('tool-card', className)} hideIcon={hideIcon} />;
    case AITool.MergeCells:
      return <MergeCells toolCall={toolCall} className={cn('tool-card', className)} hideIcon={hideIcon} />;
    case AITool.UnmergeCells:
      return <UnmergeCells toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.InsertColumns:
      return <InsertColumns toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.InsertRows:
      return <InsertRows toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.DeleteColumns:
      return <DeleteColumns toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.DeleteRows:
      return <DeleteRows toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.TableMeta:
      return <TableMeta toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.TableColumnSettings:
      return <TableColumnSettings toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.GetValidations:
      return <GetValidations toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.AddMessage:
      return <AddMessage toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.AddLogicalValidation:
      return <AddLogicalValidation toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.AddListValidation:
      return <AddListValidation toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.AddTextValidation:
      return <AddTextValidation toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.AddNumberValidation:
      return <AddNumberValidation toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.AddDateTimeValidation:
      return <AddDateTimeValidation toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.RemoveValidations:
      return <RemoveValidations toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.GetConditionalFormats:
      return <GetConditionalFormats toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.UpdateConditionalFormats:
      return <UpdateConditionalFormats toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.Undo:
      return <Undo toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.Redo:
      return <Redo toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.ContactUs:
      return <ContactUs toolCall={toolCall} className={cn('tool-card', className)} />;
    default:
      console.error(`Unknown tool: ${toolCall.name}`);
      return null;
  }
});
