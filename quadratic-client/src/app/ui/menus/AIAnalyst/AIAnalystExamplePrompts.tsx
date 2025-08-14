import { sheets } from '@/app/grid/controller/Sheets';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { CodeIcon, InsertChartIcon, TableIcon } from '@/shared/components/Icons';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useEffect, useState } from 'react';

const examples = [
  {
    title: 'Give me sample data',
    description: 'Sample data is a great way to get started with Quadratic.',
    icon: <TableIcon className="text-primary" />,
    prompt: 'Create sample data in my sheet.',
  },
  {
    title: 'Build a chart',
    description: 'Visualize your data with a chart.',
    icon: <InsertChartIcon className="text-primary" />,
    prompt: 'Help me build a chart in Quadratic. If there is no data on the sheet add sample data and plot it',
  },
  {
    title: 'Generate code',
    description: 'Use code to manipulate data, query APIs, and more.',
    icon: <CodeIcon className="text-primary" />,
    prompt: 'Help me use code in Quadratic.',
  },
];

export function AIAnalystExamplePrompts() {
  const { submitPrompt } = useSubmitAIAnalystPrompt();

  return (
    <div className="flex flex-col justify-center gap-2 px-2 pt-1">
      <TypewriterHeader />
      {examples.map(({ title, description, icon, prompt }) => (
        <button
          key={title}
          className="flex items-center gap-3 rounded border border-border px-3 py-2 hover:bg-accent"
          onClick={() => {
            trackEvent('[AIAnalyst].submitExamplePrompt', { title });
            submitPrompt({
              messageSource: 'ExamplePrompts',
              content: [{ type: 'text', text: prompt }],
              context: { sheets: [], currentSheet: sheets.sheet.name, selection: undefined },
              messageIndex: 0,
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

function TypewriterHeader() {
  const fullText = 'What can I help with?';
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startTyping, setStartTyping] = useState(false);

  // Delay starting the effect just a tad — it looks better, especially on initial page load
  useEffect(() => {
    const initialDelay = setTimeout(() => {
      setStartTyping(true);
    }, 50);

    return () => clearTimeout(initialDelay);
  }, []);

  // Type out each character, adjust the speed as necessary
  useEffect(() => {
    if (startTyping && currentIndex < fullText.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prevText) => prevText + fullText[currentIndex]);
        setCurrentIndex((prevIndex) => prevIndex + 1);
      }, 30);

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, startTyping]);

  return (
    <h2 className="mb-1 flex items-center justify-center text-center text-lg font-bold">
      {displayText}&nbsp;
      <span className="relative -top-[1px] h-5/6 w-[2px] animate-pulse bg-primary"></span>
    </h2>
  );
}

export default TypewriterHeader;
