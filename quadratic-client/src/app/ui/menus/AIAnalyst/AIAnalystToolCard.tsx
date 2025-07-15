import { AddDataTable } from '@/app/ai/toolCards/AddDataTable';
import { ConvertToTable } from '@/app/ai/toolCards/ConvertToTable';
import { NewSheet } from '@/app/ai/toolCards/CreateNewSheet';
import { DeleteCells } from '@/app/ai/toolCards/DeleteCells';
import { DeleteSheet } from '@/app/ai/toolCards/DeleteSheet';
import { DuplicateSheet } from '@/app/ai/toolCards/DuplicateSheet';
import { GetCellData } from '@/app/ai/toolCards/GetCellData';
import { GetTextFormats } from '@/app/ai/toolCards/GetTextFormats';
import { MoveCells } from '@/app/ai/toolCards/MoveCells';
import { PDFImport } from '@/app/ai/toolCards/PDFImport';
import { RenameSheet } from '@/app/ai/toolCards/RenameSheet';
import { SetCellValues } from '@/app/ai/toolCards/SetCellValues';
import { SetCodeCellValue } from '@/app/ai/toolCards/SetCodeCellValue';
import { SetFormulaCellValue } from '@/app/ai/toolCards/SetFormulaCellValue';
import { SetTextFormats } from '@/app/ai/toolCards/SetTextFormats';
import { UpdateCodeCell } from '@/app/ai/toolCards/UpdateCodeCell';
import { UserPromptSuggestionsSkeleton } from '@/app/ai/toolCards/UserPromptSuggestionsSkeleton';
import { WebSearch } from '@/app/ai/toolCards/WebSearch';
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
    case AITool.SetFormulaCellValue:
      return <SetFormulaCellValue args={args} loading={loading} />;
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
    case AITool.GetCellData:
      return <GetCellData args={args} loading={loading} />;
    case AITool.SetTextFormats:
      return <SetTextFormats args={args} loading={loading} />;
    case AITool.GetTextFormats:
      return <GetTextFormats args={args} loading={loading} />;
    case AITool.ConvertToTable:
      return <ConvertToTable args={args} loading={loading} />;
    case AITool.WebSearch:
      return <WebSearch args={args} loading={loading} />;
    case AITool.AddSheet:
      return <NewSheet args={args} loading={loading} />;
    case AITool.DuplicateSheet:
      return <DuplicateSheet args={args} loading={loading} />;
    case AITool.RenameSheet:
      return <RenameSheet args={args} loading={loading} />;
    case AITool.DeleteSheet:
      return <DeleteSheet args={args} loading={loading} />;
    default:
      console.error(`Unknown tool: ${name}`);
      return null;
  }
});
