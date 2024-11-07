import { defaultAIAnalystContext } from '@/app/atoms/aiAnalystAtom';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { CodeIcon, InsertChartIcon, TableIcon } from '@/shared/components/Icons';
import { Context } from 'quadratic-shared/typesAndSchemasAI';
import { useState } from 'react';

const examples = [
  {
    title: 'Create a table',
    description: 'All 50 U.S. states with their population and GDP',
    Icon: TableIcon,
    prompt: 'Create a table with the 50 U.S. states and their populations and GDP.',
  },
  {
    title: 'Generate code',
    description: 'The first 100 prime numbers using Python',
    Icon: CodeIcon,
    prompt: 'Generate Python code that calculates the first 100 prime numbers.',
  },
  {
    title: 'Build a chart',
    description: 'Plot Apple’s employee count by year',
    Icon: InsertChartIcon,
    prompt: 'Find data on Apple’s employee count by year up to 2020, put it in a table, then plot it.',
  },
];

export function AIAnalystExamplePrompts() {
  const [context] = useState<Context>(defaultAIAnalystContext);
  const { submitPrompt } = useSubmitAIAnalystPrompt();

  return (
    <div className="flex flex-col gap-2 px-2 pt-1">
      {examples.map(({ title, description, Icon, prompt }) => (
        <button
          key={title}
          className="flex items-center gap-3 rounded border border-border px-3 py-2 text-muted-foreground hover:bg-accent"
          onClick={() => submitPrompt({ userPrompt: prompt, context })}
        >
          <Icon className="" />
          <div className="flex flex-col text-left text-sm">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-xs">{description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
