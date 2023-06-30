import { Stack } from '@mui/material';
import { CodeSnippet } from '../../components/CodeSnippet';

const CODE_BLOCK_REGEX = /```([a-z]+)?\n([\s\S]+?)(?:\n```|$)/g;

function parseCodeBlocks(input: string): Array<string | JSX.Element> {
  const blocks: Array<string | JSX.Element> = [];
  let match;
  let lastIndex = 0;

  while ((match = CODE_BLOCK_REGEX.exec(input))) {
    const [, language, code] = match;
    if (lastIndex < match.index) {
      blocks.push(input.substring(lastIndex, match.index));
    }
    blocks.push(<CodeSnippet key={lastIndex} code={code} language={language} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < input.length) {
    blocks.push(input.substring(lastIndex));
  }
  return blocks;
}

export function CodeBlockParser({ input }: { input: string }): JSX.Element {
  return (
    <Stack gap={2} style={{ whiteSpace: 'normal', lineHeight: '1.5' }}>
      {parseCodeBlocks(input)}
    </Stack>
  );
}
