import { sheets } from '@/app/grid/controller/Sheets';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';

const examples = [
  {
    title: 'Build a chart',
    prompt: 'Help me build a chart in Quadratic. If there is no data on the sheet add sample data and plot it',
  },
  {
    title: 'Search the web',
    prompt: 'Find the top 10 companies in the US by revenue.',
  },
  {
    title: 'Connect an API',
    prompt:
      'Show me how to connect to an API using Python. Make sure it is a working example where data is fetched and put on the sheet.',
  },
];

export function AIAnalystExamplePrompts() {
  const { submitPrompt } = useSubmitAIAnalystPrompt();

  return (
    <div className="flex flex-row flex-wrap gap-1">
      {examples.map(({ title, prompt }) => (
        <button
          key={title}
          className="flex items-center gap-3 rounded bg-accent px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            trackEvent('[AIAnalyst].submitExamplePrompt', { title });
            submitPrompt({
              messageSource: 'ExamplePrompts',
              content: [createTextContent(prompt)],
              context: { sheets: [], currentSheet: sheets.sheet.name, selection: undefined },
              messageIndex: 0,
            });
          }}
        >
          {title}
        </button>
      ))}
    </div>
  );
}
