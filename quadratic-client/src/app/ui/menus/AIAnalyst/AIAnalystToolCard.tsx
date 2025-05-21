import { AddDataTable } from '@/app/ai/toolCards/AddDataTable';
import { DeleteCells } from '@/app/ai/toolCards/DeleteCells';
import { MoveCells } from '@/app/ai/toolCards/MoveCells';
import { PDFImport } from '@/app/ai/toolCards/PDFImport';
import { SetCellValues } from '@/app/ai/toolCards/SetCellValues';
import { SetCodeCellValue } from '@/app/ai/toolCards/SetCodeCellValue';
import { UpdateCodeCell } from '@/app/ai/toolCards/UpdateCodeCell';
import { UserPromptSuggestionsSkeleton } from '@/app/ai/toolCards/UserPromptSuggestionsSkeleton';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo } from 'react';

type AIAnalystToolCardProps = {
  name: string;
  args: string;
  loading: boolean;
};

export const AIAnalystToolCard = memo(({ name, args, loading }: AIAnalystToolCardProps) => {
  if (!Object.values(AITool).includes(name as AITool)) {
    return null;
  }

  switch (name) {
    case AITool.AddDataTable:
      return <AddDataTable args={args} loading={loading} />;
    case AITool.SetCellValues:
      return <SetCellValues args={args} loading={loading} />;
    case AITool.SetCodeCellValue:
      return <SetCodeCellValue args={args} loading={loading} />;
    case AITool.MoveCells:
      return <MoveCells args={args} loading={loading} />;
    case AITool.DeleteCells:
      return <DeleteCells args={args} loading={loading} />;
    case AITool.UpdateCodeCell:
      return <UpdateCodeCell args={args} loading={loading} />;
    case AITool.UserPromptSuggestions:
      return <UserPromptSuggestionsSkeleton args={args} loading={loading} />;
    case AITool.PDFImport:
      return <PDFImport args={args} loading={loading} />;
    default:
      console.error(`Unknown tool: ${name}`);
      return null;
  }
});
