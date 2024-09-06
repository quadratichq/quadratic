import { Markdown } from '@/app/ui/components/Markdown';
import { CodeSnippet } from '../../components/CodeSnippet';

// Regular expression to match code blocks
const CODE_BLOCK_REGEX = /```([a-zA-Z]+)?\n([\s\S]+?)(?:\n```|$)/g;

export function parseCodeBlocks(input: string): Array<string | JSX.Element> {
  const blocks: Array<string | JSX.Element> = [];
  let match;
  let lastIndex = 0;

  // Iterate through all matches of the regex in the input string
  while ((match = CODE_BLOCK_REGEX.exec(input))) {
    const [, language, code] = match;

    // Add any text before the current code block
    if (lastIndex < match.index) {
      blocks.push(
        <Markdown key={`markdown-${lastIndex}-${match.index}`}>{input.substring(lastIndex, match.index)}</Markdown>
      );
    }

    // Add the code block as a CodeSnippet component
    blocks.push(<CodeSnippet key={`codesnippet-${lastIndex}-${match.index}`} code={code} language={language} />);
    lastIndex = CODE_BLOCK_REGEX.lastIndex;
  }

  // Add any remaining text after the last code block
  if (lastIndex < input.length) {
    blocks.push(<Markdown key={`markdown-${lastIndex}-${input.length}`}>{input.substring(lastIndex)}</Markdown>);
  }

  return blocks;
}

export function CodeBlockParser({ input }: { input: string }): JSX.Element {
  return <div className="flex select-text flex-col gap-4 whitespace-normal">{parseCodeBlocks(input)}</div>;
}
