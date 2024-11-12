import { sheets } from '@/app/grid/controller/Sheets';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { CodeIcon, InsertChartIcon, TableIcon } from '@/shared/components/Icons';
import mixpanel from 'mixpanel-browser';

const examples = [
  {
    title: 'Create a table',
    description: 'All 50 U.S. states with their population and GDP',
    icon: <TableIcon className="text-primary" />,
    prompt: 'Create a table with the 50 U.S. states and their populations and GDP.',
  },
  {
    title: 'Generate code',
    description: 'The first 100 prime numbers using Python',
    icon: <CodeIcon className="text-primary" />,
    prompt: 'Generate Python code that calculates the first 100 prime numbers.',
  },
  {
    title: 'Build a chart',
    description: 'Plot Apple’s employee count by year',
    icon: <InsertChartIcon className="text-primary" />,
    prompt: 'Find data on Apple’s employee count by year up to 2020, put it in a table, then plot it.',
  },
];

export function AIAnalystExamplePrompts() {
  const { submitPrompt } = useSubmitAIAnalystPrompt();

  return (
    <div className="flex flex-col gap-2 px-2 pt-1">
      {examples.map(({ title, description, icon, prompt }) => (
        <button
          key={title}
          className="flex items-center gap-3 rounded border border-border px-3 py-2 hover:bg-accent"
          onClick={() => {
            mixpanel.track('[AIAnalyst].submitExamplePrompt', { title });
            submitPrompt({
              userPrompt: prompt,
              context: { sheets: [], currentSheet: sheets.sheet.name, selection: undefined },
            });
          }}
        >
          {icon}

          <div className="flex flex-col text-left text-sm">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
