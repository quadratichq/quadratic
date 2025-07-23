import { AddDataTable } from '@/app/ai/toolCards/AddDataTable';
import { ColorSheets } from '@/app/ai/toolCards/ColorSheets';
import { ConvertToTable } from '@/app/ai/toolCards/ConvertToTable';
import { NewSheet } from '@/app/ai/toolCards/CreateNewSheet';
import { DeleteCells } from '@/app/ai/toolCards/DeleteCells';
import { DeleteColumns } from '@/app/ai/toolCards/DeleteColumns';
import { DeleteRows } from '@/app/ai/toolCards/DeleteRows';
import { DeleteSheet } from '@/app/ai/toolCards/DeleteSheet';
import { DuplicateSheet } from '@/app/ai/toolCards/DuplicateSheet';
import { GetCellData } from '@/app/ai/toolCards/GetCellData';
import { GetTextFormats } from '@/app/ai/toolCards/GetTextFormats';
import { HasCellData } from '@/app/ai/toolCards/HasCellData';
import { InsertColumns } from '@/app/ai/toolCards/InsertColumns';
import { InsertRows } from '@/app/ai/toolCards/InsertRows';
import { MoveCells } from '@/app/ai/toolCards/MoveCells';
import { MoveSheet } from '@/app/ai/toolCards/MoveSheet';
import { PDFImport } from '@/app/ai/toolCards/PDFImport';
import { RenameSheet } from '@/app/ai/toolCards/RenameSheet';
import { RerunCode } from '@/app/ai/toolCards/RerunCode';
import { ResizeColumns } from '@/app/ai/toolCards/ResizeColumns';
import { ResizeRows } from '@/app/ai/toolCards/ResizeRows';
import { SetBorders } from '@/app/ai/toolCards/SetBorders';
import { SetCellValues } from '@/app/ai/toolCards/SetCellValues';
import { SetCodeCellValue } from '@/app/ai/toolCards/SetCodeCellValue';
import { SetFormulaCellValue } from '@/app/ai/toolCards/SetFormulaCellValue';
import { SetTextFormats } from '@/app/ai/toolCards/SetTextFormats';
import { TextSearch } from '@/app/ai/toolCards/TextSearch';
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
    case AITool.MoveSheet:
      return <MoveSheet args={args} loading={loading} />;
    case AITool.ColorSheets:
      return <ColorSheets args={args} loading={loading} />;
    case AITool.TextSearch:
      return <TextSearch args={args} loading={loading} />;
    case AITool.HasCellData:
      return <HasCellData args={args} loading={loading} />;
    case AITool.RerunCode:
      return <RerunCode args={args} loading={loading} />;
    case AITool.ResizeColumns:
      return <ResizeColumns args={args} loading={loading} />;
    case AITool.ResizeRows:
      return <ResizeRows args={args} loading={loading} />;
    case AITool.SetBorders:
      return <SetBorders args={args} loading={loading} />;
    case AITool.InsertColumns:
      return <InsertColumns args={args} loading={loading} />;
    case AITool.InsertRows:
      return <InsertRows args={args} loading={loading} />;
    case AITool.DeleteColumns:
      return <DeleteColumns args={args} loading={loading} />;
    case AITool.DeleteRows:
      return <DeleteRows args={args} loading={loading} />;
    default:
      return null;
  }
});
