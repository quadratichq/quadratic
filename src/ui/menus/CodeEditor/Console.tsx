import { Box, Tab, Tabs } from '@mui/material';
import { useTheme } from '@mui/system';
import { stripIndent } from 'common-tags';
import { useState } from 'react';
import { useRecoilValue } from 'recoil';
import { isViewerOrAbove } from '../../../actions';
import { EditorInteractionState, editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { DOCUMENTATION_FORMULAS_URL, DOCUMENTATION_PYTHON_URL } from '../../../constants/urls';
// import { CodeCellRunOutput, CodeCellValue } from '../../../quadratic-core/types';
import { Circle } from '@mui/icons-material';
import { colors } from '../../../theme/colors';
import { CodeSnippet } from '../../components/CodeSnippet';
import { LinkNewTab } from '../../components/LinkNewTab';
import { AITab } from './AITab';
import { codeEditorBaseStyles, codeEditorCommentStyles } from './styles';

// todo: fix types

interface ConsoleProps {
  consoleOutput?: { stdOut?: string; stdErr?: string };
  editorMode: EditorInteractionState['mode'];
  editorContent: string | undefined;
  evaluationResult?: any;
}

export function Console({ consoleOutput, editorMode, editorContent, evaluationResult }: ConsoleProps) {
  const { permission } = useRecoilValue(editorInteractionStateAtom);
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  const theme = useTheme();
  let hasOutput = Boolean(consoleOutput?.stdErr?.length || consoleOutput?.stdOut?.length);

  // Whenever we change to a different cell, reset the active tab to the 1st
  // useEffect(() => {
  //   setActiveTabIndex(0);
  // }, [selectedCell]);

  return (
    <>
      <Box>
        <Tabs
          value={activeTabIndex}
          onChange={(e: React.SyntheticEvent, newValue: number) => {
            setActiveTabIndex(newValue);
          }}
          aria-label="Console"
          style={{ minHeight: '32px' }}
        >
          <Tab
            style={{ minHeight: '32px' }}
            label="Console"
            id="console-tab-0"
            aria-controls="console-tabpanel-0"
            icon={hasOutput ? <Circle sx={{ fontSize: 10 }}></Circle> : undefined}
            iconPosition="end"
          ></Tab>
          <Tab
            style={{ minHeight: '32px' }}
            label="Documentation"
            id="console-tab-1"
            aria-controls="console-tabpanel-1"
          ></Tab>
          {editorMode === 'PYTHON' && isViewerOrAbove(permission) && (
            <Tab
              style={{ minHeight: '32px' }}
              label="AI Assistant"
              id="console-tab-4"
              aria-controls="console-tabpanel-2"
            ></Tab>
          )}
        </Tabs>
      </Box>
      <div style={{ flex: '2', overflow: 'scroll', fontSize: '.875rem', lineHeight: '1.5' }}>
        <TabPanel value={activeTabIndex} index={0}>
          <div
            contentEditable="true"
            suppressContentEditableWarning={true}
            spellCheck={false}
            onKeyDown={(e) => {
              if (((e.metaKey || e.ctrlKey) && e.key === 'a') || ((e.metaKey || e.ctrlKey) && e.key === 'c')) {
                // Allow a few commands, but nothing else
              } else {
                e.preventDefault();
              }
            }}
            style={{
              outline: 'none',
              whiteSpace: 'pre-wrap',
              ...codeEditorBaseStyles,
            }}
            // Disable Grammarly
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
          >
            {hasOutput ? (
              <>
                {consoleOutput?.stdErr && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.error }}>
                    ERROR: {consoleOutput?.stdErr}
                  </span>
                )}
                {consoleOutput?.stdOut}
              </>
            ) : (
              <div style={{ ...codeEditorCommentStyles, marginTop: theme.spacing(0.5) }}>
                {editorMode === 'PYTHON'
                  ? 'Print statements, standard out, and errors will show here.'
                  : 'Errors will show here.'}
              </div>
            )}
          </div>
        </TabPanel>
        <TabPanel value={activeTabIndex} index={1}>
          {editorMode === 'PYTHON' ? (
            <div style={{ overflow: 'scroll' }}>
              <h4>Logging</h4>
              <p>`print()` statements and errors are logged in the CONSOLE tab.</p>
              <h4>Returning data to the sheet</h4>
              <p>The last statement in your code is returned to the sheet.</p>
              <p>Example:</p>

              <CodeSnippet
                language="python"
                code={stripIndent`
                  2 * 2
                  # Returns the value '4' to the active cell
                `}
              />

              <p>Example:</p>

              <CodeSnippet
                language="python"
                code={stripIndent`
                  result = []
                  for x in range(100):
                      result.append(x)

                  result
                  # Returns a list of 100 numbers, from 0 to 99
                  # [0, 1, 2, ..., 99]
                `}
              />

              <h4>Referencing data from the sheet</h4>
              <p>Use the `cell(x, y)` function — or shorthand `c(x, y)` — to reference values in the sheet.</p>
              <p>Example:</p>

              <CodeSnippet
                language="python"
                code={stripIndent`
                  c(1, 1) + c(2, 2)
                  # Returns the sum of the cell values at (x:1, y:1) and (x:2, y:2)
                `}
              />

              <h4>Advanced topics</h4>
              <ul>
                <li>Fetching data from an API.</li>
                <li>Using Pandas DataFrames.</li>
                <li>Installing third-party packages.</li>
              </ul>
              <p>
                <LinkNewTab href={DOCUMENTATION_PYTHON_URL}>Learn more in our documentation</LinkNewTab>.
              </p>
              <br />
            </div>
          ) : (
            <>
              <h4>Spreadsheet formulas</h4>
              <p>Use the familiar language of spreadsheet formulas.</p>
              <p>Example:</p>

              <CodeSnippet language="formula" code={`SUM(A0:A99)`} />

              <h4>Referencing cells</h4>
              <p>
                In the positive quadrant, cells are referenced similar to other spreadsheets. In the negative quadrant,
                cells are referenced using a `n` prefix.
              </p>
              <p>Examples:</p>
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>
                      <code>nAn0</code>
                    </th>
                    <th style={{ textAlign: 'left' }}>
                      <code>(x, y)</code>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['A0', '(0,0)'],
                    ['A1', '(0, 1)'],
                    ['B1', '(1, 1)'],
                    ['An1', '(0, -1)'],
                    ['nA1', '(-1, 1)'],
                    ['nAn1', '(-1, -1)'],
                  ].map(([key, val]) => (
                    <tr key={key}>
                      <td style={{ minWidth: '5rem' }}>
                        <code>{key}</code>
                      </td>
                      <td>
                        <code>{val}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4>Multiline formulas</h4>
              <p>
                Line spaces are ignored when evaluating formulas. You can use them to make your formulas more readable.
              </p>
              <p>Example:</p>

              <CodeSnippet
                language="formula"
                code={stripIndent`
                  IF(A0 > 0,
                    IF(B0 < 2,
                      "Valid Dataset",
                      "B0 is invalid"
                    ),
                    "A0 is invalid"
                  )
                `}
              />

              <h4>More info</h4>
              <p>
                <LinkNewTab href={DOCUMENTATION_FORMULAS_URL}>Check out the docs</LinkNewTab> to see a full list of
                supported formulas and documentation for how to use specific formula functions.
              </p>
              <br></br>
            </>
          )}
        </TabPanel>
        <TabPanel value={activeTabIndex} index={2}>
          <AITab
            // todo: fix this
            evalResult={evaluationResult}
            editorMode={editorMode}
            editorContent={editorContent}
            isActive={activeTabIndex === 2}
          ></AITab>
        </TabPanel>
      </div>
    </>
  );
}

function TabPanel(props: { children: React.ReactElement; value: number; index: number }) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`console-tabpanel-${index}`}
      aria-labelledby={`console-tab-${index}`}
      {...other}
    >
      {/* {value === index && ( */}
      <div style={{ padding: '.5rem 1rem 0 1rem' }}>{children}</div>
      {/* )} */}
    </div>
  );
}
