import { AddDataTable } from '@/app/ai/toolCards/AddDataTable';
import { ConvertToTable } from '@/app/ai/toolCards/ConvertToTable';
import { DeleteCells } from '@/app/ai/toolCards/DeleteCells';
import { GetCellData } from '@/app/ai/toolCards/GetCellData';
import { GetDatabaseSchemas } from '@/app/ai/toolCards/GetDatabaseSchemas';
import { GetTextFormats } from '@/app/ai/toolCards/GetTextFormats';
import { MoveCells } from '@/app/ai/toolCards/MoveCells';
import { PDFImport } from '@/app/ai/toolCards/PDFImport';
import { SetCellValues } from '@/app/ai/toolCards/SetCellValues';
import { SetCodeCellValue } from '@/app/ai/toolCards/SetCodeCellValue';
import { SetFormulaCellValue } from '@/app/ai/toolCards/SetFormulaCellValue';
import { SetTextFormats } from '@/app/ai/toolCards/SetTextFormats';
import { UpdateCodeCell } from '@/app/ai/toolCards/UpdateCodeCell';
import { UserPromptSuggestionsSkeleton } from '@/app/ai/toolCards/UserPromptSuggestionsSkeleton';
import { WebSearch } from '@/app/ai/toolCards/WebSearch';
import { cn } from '@/shared/shadcn/utils';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo } from 'react';

type AIToolCardProps = {
  toolCall: AIToolCall;
  className?: string;
};

export const AIToolCard = memo(({ toolCall, className }: AIToolCardProps) => {
  if (!Object.values(AITool).includes(toolCall.name as AITool)) {
    return null;
  }

  switch (toolCall.name) {
    case AITool.AddDataTable:
      return <AddDataTable toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.SetCellValues:
      return <SetCellValues toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.SetCodeCellValue:
      return <SetCodeCellValue toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.SetFormulaCellValue:
      return <SetFormulaCellValue toolCall={toolCall} className={cn('tool-card', className)} />;
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
      return <SetTextFormats toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.GetTextFormats:
      return <GetTextFormats toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.ConvertToTable:
      return <ConvertToTable toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.WebSearch:
      return <WebSearch toolCall={toolCall} className={cn('tool-card', className)} />;
    case AITool.GetDatabaseSchemas:
      return <GetDatabaseSchemas toolCall={toolCall} className={cn('tool-card', className)} />;
    default:
      console.error(`Unknown tool: ${toolCall.name}`);
      return null;
  }
});
