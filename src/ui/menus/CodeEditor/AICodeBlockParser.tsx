import Editor from '@monaco-editor/react';

const CODE_BLOCK_REGEX = /```([a-z]+)?\n([\s\S]+?)\n```/g;

function parseCodeBlocks(input: string): Array<string | JSX.Element> {
  const blocks: Array<string | JSX.Element> = [];
  let match;
  let lastIndex = 0;

  while ((match = CODE_BLOCK_REGEX.exec(input))) {
    const [, language, code] = match;
    if (lastIndex < match.index) {
      blocks.push(input.substring(lastIndex, match.index));
    }
    blocks.push(
      <div
        key={lastIndex}
        // calculate height based on number of lines
        style={{
          height: `${Math.ceil(code.split('\n').length) * 19}px`,
          width: '100%',
        }}
      >
        <Editor
          language={language}
          value={code}
          height="100%"
          width="100%"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              vertical: 'hidden',
              horizontal: 'hidden',
              handleMouseWheel: false,
            },
            scrollBeyondLastLine: false,
            wordWrap: 'off',
            // lineNumbers: 'off',
            automaticLayout: true,
          }}
        />
      </div>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < input.length) {
    blocks.push(input.substring(lastIndex));
  }
  return blocks;
}

export function CodeBlockParser({ input }: { input: string }): JSX.Element {
  return <>{parseCodeBlocks(input)}</>;
}
