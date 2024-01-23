import monaco from 'monaco-editor';
import { Fragment, RefObject, useEffect, useState } from 'react';
import useLocalStorage from '../../../hooks/useLocalStorage';
import { codeEditorBaseStyles, codeEditorCommentStyles } from './styles';

export const snippets = [
  {
    label: '- query API',
    // prettier-ignore
    code:
      `import requests 
import pandas as pd 

# Fetch data
response = requests.get('https://jsonplaceholder.typicode.com/users')

# Place data into DataFrame
df = pd.DataFrame(response.json())

# Display DataFrame to sheet 
df
`,
  },
  {
    label: '- reference cells',
    // prettier-ignore
    code:
      `# Reference a value from the sheet
value = cell(x, y)

# Or reference a range of cells (returns a Pandas DataFrame)
df = cells((x1, y1), (x2, y2))`,
  },
  {
    label: '- create a chart',
    // prettier-ignore
    code:
      `# install plotly 
import micropip
await micropip.install('plotly')

# import plotly
import plotly.express as px

# replace this df with your data
df = px.data.gapminder().query("country=='Canada'")

# create your chart type, for more chart types: https://plotly.com/python/
fig = px.line(df, x="year", y="lifeExp", title='Life expectancy in Canada', width=450, height=300)

# make chart prettier
fig.update_layout(
    plot_bgcolor="White",
    margin=dict(l=30, r=33, t=50, b=28),
)

# display chart 
fig.show()
`,
  },
  {
    label: '- return data to the sheet',
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
  const [shouldRunEffect, setShouldRunEffect] = useState<boolean>(false);

  // When the user chooses to autofill the editor with a predefined snippet,
  // focus the editor and set the initial cursor position
  useEffect(() => {
    if (editorRef && editorRef.current && shouldRunEffect) {
      editorRef.current.focus();
      editorRef.current.setPosition({ lineNumber: 0, column: 0 });
      setShouldRunEffect(false);
    }
  }, [editorRef, editorContent, shouldRunEffect]);

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
      Start with a code snippet to:
      <br />
      {' '}
      {snippets.map((snippet, i: number) => (
        <Fragment key={i}>
          <a
            href={`#snippet-${i}`}
            className={`pointer-events-auto text-inherit underline`}
            onClick={(e) => {
              e.preventDefault();
              setEditorContent(snippet.code);
              setShouldRunEffect(true);
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
