import { Stack } from '@mui/material';
import { CodeSnippet } from '../../components/CodeSnippet';

// Regular expression to match code blocks
const CODE_BLOCK_REGEX = /```([a-zA-Z]+)?\n([\s\S]+?)\n```/g;

export function parseCodeBlocks(input: string): Array<string | JSX.Element> {
  const blocks: Array<string | JSX.Element> = [];
  let match;
  let lastIndex = 0;

  // Iterate through all matches of the regex in the input string
  while ((match = CODE_BLOCK_REGEX.exec(input))) {
    const [, language, code] = match;

    // Add any text before the current code block
    if (lastIndex < match.index) {
      blocks.push(input.substring(lastIndex, match.index));
    }

    // Add the code block as a CodeSnippet component
    blocks.push(<CodeSnippet key={lastIndex} code={code} language={language} />);
    lastIndex = CODE_BLOCK_REGEX.lastIndex;
  }

  // Add any remaining text after the last code block
  if (lastIndex < input.length) {
    blocks.push(input.substring(lastIndex));
  }

  return blocks;
}

export function CodeBlockParser({ input }: { input: string }): JSX.Element {
  return (
    <Stack gap={2} className="select-text">
      {parseCodeBlocks(input)}
    </Stack>
  );
}
