import { AddDataTable } from '@/app/ai/toolCards/AddDataTable';
import { ConvertToTable } from '@/app/ai/toolCards/ConvertToTable';
import { DeleteCells } from '@/app/ai/toolCards/DeleteCells';
import { GetCellData } from '@/app/ai/toolCards/GetCellData';
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
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo } from 'react';

type AIToolCardProps = {
  toolCall: AIToolCall;
};

export const AIToolCard = memo(({ toolCall }: AIToolCardProps) => {
  if (!Object.values(AITool).includes(toolCall.name as AITool)) {
    return null;
  }

  switch (toolCall.name) {
    case AITool.AddDataTable:
      return <AddDataTable toolCall={toolCall} />;
    case AITool.SetCellValues:
      return <SetCellValues toolCall={toolCall} />;
    case AITool.SetCodeCellValue:
      return <SetCodeCellValue toolCall={toolCall} />;
    case AITool.SetFormulaCellValue:
      return <SetFormulaCellValue toolCall={toolCall} />;
    case AITool.MoveCells:
      return <MoveCells toolCall={toolCall} />;
    case AITool.DeleteCells:
      return <DeleteCells toolCall={toolCall} />;
    case AITool.UpdateCodeCell:
      return <UpdateCodeCell toolCall={toolCall} />;
    case AITool.UserPromptSuggestions:
      return <UserPromptSuggestionsSkeleton toolCall={toolCall} />;
    case AITool.PDFImport:
      return <PDFImport toolCall={toolCall} />;
    case AITool.GetCellData:
      return <GetCellData toolCall={toolCall} />;
    case AITool.SetTextFormats:
      return <SetTextFormats toolCall={toolCall} />;
    case AITool.GetTextFormats:
      return <GetTextFormats toolCall={toolCall} />;
    case AITool.ConvertToTable:
      return <ConvertToTable toolCall={toolCall} />;
    case AITool.WebSearch:
      return <WebSearch toolCall={toolCall} />;
    default:
      console.error(`Unknown tool: ${toolCall.name}`);
      return null;
  }
});
