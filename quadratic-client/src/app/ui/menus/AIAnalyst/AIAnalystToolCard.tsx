import { AITool } from '@/app/ai/tools/aiTools';
import { DeleteCells } from '@/app/ui/menus/AIAnalyst/toolCards/DeleteCells';
import { MoveCells } from '@/app/ui/menus/AIAnalyst/toolCards/MoveCells';
import { SetCellValues } from '@/app/ui/menus/AIAnalyst/toolCards/SetCellValues';
import { SetCodeCellValue } from '@/app/ui/menus/AIAnalyst/toolCards/SetCodeCellValue';

type AIAnalystToolCardProps = {
  name: string;
  args: string;
  loading: boolean;
};

export const AIAnalystToolCard = ({ name, args, loading }: AIAnalystToolCardProps) => {
  if (!Object.values(AITool).includes(name as AITool)) {
    return null;
  }

  switch (name) {
    case AITool.SetCodeCellValue:
      return <SetCodeCellValue args={args} loading={loading} />;
    case AITool.SetCellValues:
      return <SetCellValues args={args} loading={loading} />;
    case AITool.MoveCells:
      return <MoveCells args={args} loading={loading} />;
    case AITool.DeleteCells:
      return <DeleteCells args={args} loading={loading} />;
    default:
      return null;
  }
};
