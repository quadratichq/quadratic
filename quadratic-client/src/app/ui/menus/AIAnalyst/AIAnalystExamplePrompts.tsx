import { sheets } from '@/app/grid/controller/Sheets';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { CodeIcon, InsertChartIcon, TableIcon } from '@/shared/components/Icons';
import mixpanel from 'mixpanel-browser';
import { useEffect, useState } from 'react';

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
    <div className="flex flex-col justify-center gap-2 px-2 pt-1">
      <TypewriterHeader />
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
