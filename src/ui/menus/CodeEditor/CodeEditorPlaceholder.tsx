import { Fragment, useEffect, RefObject } from 'react';
import useLocalStorage from '../../../hooks/useLocalStorage';
import { codeEditorBaseStyles, codeEditorCommentStyles } from './styles';
import monaco from 'monaco-editor';

export const snippets = [
  {
    label: 'fetch data',
    // prettier-ignore
    code:
`import json
from pyodide.http import pyfetch

# Fetch data
res = await pyfetch(
  'https://jsonplaceholder.typicode.com/users',
  method = 'GET',
  headers = {
    'Content-Type': 'application/json'
  }
)
users = json.loads(await res.string())

# Table
out = []

# Headers
out.append(['Username',  'Email', 'Website'])

# Rows (from json)
for user in users:
    out.append([user['username'], user['email'], user['website']])
 
# Last line returns to sheet
out`,
  },
  {
    label: 'reference cells',
    // prettier-ignore
    code: 
`# Reference a value from the sheet
myCell = cell(x, y)

# Or reference a range of cells (returns a Pandas DataFrame)
cells((x1, y1), (x2, y2))`,
  },
  {
    label: 'return data to the sheet',
    // prettier-ignore
    code: 
`out = []
for x in range(10):
    out.append(x)

# Last line returns to the sheet
out
# [out] # Wrap in array to expand horizontally`,
  },
];

export function CodeEditorPlaceholder({
  editorContent,
  editorRef,
  setEditorContent,
}: {
  editorContent: string | undefined;
  editorRef: RefObject<monaco.editor.IStandaloneCodeEditor | null>;
  setEditorContent: (str: string | undefined) => void;
}) {
  const [showPlaceholder, setShowPlaceholder] = useLocalStorage<boolean>('showCodeEditorPlaceholder', true);

  // When autofill the snippet, focus the editor at the initial position
  useEffect(() => {
    if (editorRef && editorRef.current) {
      editorRef.current.focus();
      editorRef.current.setPosition({ lineNumber: 0, column: 0 });
    }
  }, [editorRef, editorContent]);

  if (editorContent) {
    return null;
  }

  if (!showPlaceholder) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: '64px',
        right: '14%',
        top: 0,
        pointerEvents: 'none',
        // Kinda hacky, but we're copying the style of the code editor
        ...codeEditorBaseStyles,
        ...codeEditorCommentStyles,
      }}
    >
      Start with a code snippet to{' '}
      {snippets.map((snippet, i: number) => (
        <Fragment key={i}>
          <a
            href={`#snippet-${i}`}
            style={{ color: 'inherit', pointerEvents: 'auto' }}
            onClick={(e) => {
              e.preventDefault();
              setEditorContent(snippet.code);
            }}
          >
            {snippet.label}
          </a>
          {i === snippets.length - 1 ? '.' : i < snippets.length - 2 ? ', ' : ', or '}
        </Fragment>
      ))}
      <br />
      <br />
      Start typing to dismiss or{' '}
      <a
        href="#dont-show-again"
        style={{ color: 'inherit', pointerEvents: 'auto' }}
        onClick={(e) => {
          e.preventDefault();
          setShowPlaceholder(false);
        }}
      >
        don’t show this again
      </a>
      .
    </div>
  );
}
