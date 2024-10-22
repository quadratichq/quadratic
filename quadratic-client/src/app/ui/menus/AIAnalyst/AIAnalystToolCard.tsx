import { AITool } from '@/app/ai/tools/aiTools';
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
    default:
      return null;
  }
};
