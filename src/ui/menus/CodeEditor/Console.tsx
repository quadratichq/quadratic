import { Box, Tabs, Tab } from '@mui/material';
import { CSSProperties, useState } from 'react';
import { cellEvaluationReturnType } from '../../../grid/computations/types';
import { LinkNewTab } from '../../components/LinkNewTab';
import { colors } from '../../../theme/colors';
import { DOCUMENTATION_FORMULAS_URL, DOCUMENTATION_PYTHON_URL } from '../../../constants/urls';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { useTheme } from '@mui/system';

interface ConsoleProps {
  editorMode: EditorInteractionState['mode'];
  evalResult: cellEvaluationReturnType | undefined;
}

export function Console({ evalResult, editorMode }: ConsoleProps) {
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  const { std_err = '', std_out = '' } = evalResult || {};
  let hasOutput = Boolean(std_err.length || std_out.length);
  const theme = useTheme();

  const codeSampleStyles: CSSProperties = {
    backgroundColor: colors.lightGray,
    padding: theme.spacing(1),
    whiteSpace: 'pre-wrap',
  };

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
          ></Tab>
          <Tab
            style={{ minHeight: '32px' }}
            label="Documentation"
            id="console-tab-1"
            aria-controls="console-tabpanel-1"
          ></Tab>
        </Tabs>
      </Box>
      <div style={{ overflow: 'scroll', flex: '2' }}>
        <TabPanel value={activeTabIndex} index={0}>
          <div
            contentEditable="true"
            suppressContentEditableWarning={true}
            spellCheck={false}
            onKeyDown={(e) => {
              if (((e.metaKey || e.ctrlKey) && e.code === 'KeyA') || ((e.metaKey || e.ctrlKey) && e.code === 'KeyC')) {
                // Allow a few commands, but nothing else
              } else {
                e.preventDefault();
              }
            }}
            style={{ outline: 'none' }}
            // Disable Grammarly
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
          >
            {hasOutput && (
              <>
                {std_err && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.error }}>
                    ERROR: {std_err}
                  </span>
                )}
                {std_out}
              </>
            )}
          </div>
        </TabPanel>
        <TabPanel value={activeTabIndex} index={1}>
          {editorMode === 'PYTHON' ? (
            <>
              <h3>Logging</h3>
              <p>`print()` statements and errors are logged in the CONSOLE tab.</p>
              <h3>Returning data to the sheet</h3>
              <p>The last statement in your code is returned to the sheet.</p>
              <p>Example:</p>
              <pre style={codeSampleStyles}>
                <span style={{ color: 'grey' }}>1</span> <span style={{ color: 'blue' }}>2</span> *{' '}
                <span style={{ color: 'blue' }}>2</span>
                <br />
                <span style={{ color: 'grey' }}>↳ 4 # number returned as the cell value</span>
              </pre>
              <p>Example:</p>
              <pre style={codeSampleStyles}>
                <span style={{ color: 'grey' }}>1</span> result = <span style={{ color: 'blue' }}>[]</span>
                <br />
                <span style={{ color: 'grey' }}>2</span> <span style={{ color: 'red' }}>for</span> x{' '}
                <span style={{ color: 'red' }}>in </span>
                <span style={{ color: 'blue' }}>range</span>(100):
                <br></br>
                <span style={{ color: 'grey' }}>3</span> {'  '}
                result.<span style={{ color: 'blue' }}>append</span>(x)
                <br />
                <span style={{ color: 'grey' }}>4</span>
                <br />
                <span style={{ color: 'grey' }}>5</span> result
                <br />
                <span style={{ color: 'grey' }}>↳ [0, 1, 2, ..., 99] # returns 100 cells counting from 0 to 99</span>
              </pre>

              <h3>Referencing data from the sheet</h3>
              <p>Use the `cell(x, y)` function — or shorthand `c(x, y)` — to reference values in the sheet.</p>
              <p>Example:</p>
              <pre style={codeSampleStyles}>
                <span style={{ color: 'grey' }}>1</span> <span style={{ color: 'blue' }}>c</span>(1, 1) +{' '}
                <span style={{ color: 'blue' }}>c</span>(2, 2)
                <br />
                <span style={{ color: 'grey' }}>↳ The sum of the cell values at x:1 y:1 and x:2 y:2</span>
              </pre>

              <h3>Advanced topics</h3>
              <ul>
                <li>Fetching data from an API.</li>
                <li>Using Pandas DataFrames.</li>
                <li>Installing third-party packages.</li>
              </ul>
              <p>
                <LinkNewTab href={DOCUMENTATION_PYTHON_URL}>Learn more in our documenation</LinkNewTab>.
              </p>
              <br />
            </>
          ) : (
            <>
              <h3>Spreadsheet formulas</h3>
              <p>Use the familiar language of spreadsheet formulas.</p>
              <p>Example:</p>
              <pre style={codeSampleStyles}>
                <span style={{ color: 'grey' }}>1</span> <span style={{ color: 'blue' }}>SUM</span>(A0:A99)
                <br />
                <span style={{ color: 'grey' }}>↳ Returns the SUM of cells A0 to A99</span>
              </pre>
              <h3>Referencing cells</h3>
              <p>
                In the positive quadrant, cells are referenced similar to other spreadsheets. In the negative quadrant,
                cells are referenced using a `n` prefix.
              </p>
              <p>Examples:</p>
              <table>
                <tbody>
                  <tr>
                    <td>
                      <div>
                        <span>
                          <span>
                            <strong>nAn0 notation</strong>
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span>
                          <span>
                            <code>
                              <strong>(x, y)</strong>
                            </code>
                          </span>
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div>
                        <span>
                          <span>
                            <code>A0</code>
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span>
                          <span>
                            <code>(0, 0)</code>
                          </span>
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div>
                        <span>
                          <span>
                            <code>A1</code>
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span>
                          <span>
                            <code>(0, 1)</code>
                          </span>
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div>
                        <span>
                          <span>
                            <code>B1</code>
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span>
                          <span>
                            <code>(1, 1)</code>
                          </span>
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div>
                        <span>
                          <span>
                            <code>An1</code>
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span>
                          <span>
                            <code>(0, -1)</code>
                          </span>
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div>
                        <span>
                          <span>
                            <code>nA1</code>
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span>
                          <span>
                            <code>(-1, 1)</code>
                          </span>
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div>
                        <span>
                          <span>
                            <code>nAn1</code>
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span>
                          <span>
                            <code>(-1, -1)</code>
                          </span>
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <h3>Multiline formulas</h3>
              <p>
                Line spaces are ignored when evaluating formulas. You can use them to make your formulas more readable.
              </p>
              <p>Example:</p>
              <pre style={codeSampleStyles}>
                <span style={{ color: 'grey' }}>1</span> <span style={{ color: 'blue' }}>IF</span>(A0 {'>'} 0,
                <br></br>
                <span style={{ color: 'grey' }}>2</span> <span style={{ color: 'blue' }}>&nbsp;&nbsp;IF</span>(B0 {'<'}{' '}
                2,
                <br></br>
                <span style={{ color: 'grey' }}>3</span> &nbsp;&nbsp;&nbsp;&nbsp;"Valid Dataset",
                <br></br>
                <span style={{ color: 'grey' }}>3</span> &nbsp;&nbsp;&nbsp;&nbsp;"B0 is invalid",
                <br></br>
                <span style={{ color: 'grey' }}>4</span> &nbsp;&nbsp;),
                <br></br>
                <span style={{ color: 'grey' }}>3</span> &nbsp;&nbsp;"A0 is invalid",
                <br></br>
                <span style={{ color: 'grey' }}>5</span> )<br></br>
              </pre>
              <h3>More info</h3>
              <p>
                <LinkNewTab href={DOCUMENTATION_FORMULAS_URL}>Check out the docs</LinkNewTab> to see a full list of
                supported formulas and documentation for how to use specific formula functions.
              </p>
              <br></br>
            </>
          )}
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
      {value === index && (
        <pre
          style={{
            fontFamily: 'monospace',
            fontSize: '.875rem',
            padding: '0 1rem',
            lineHeight: '1.3',
            whiteSpace: 'pre-wrap',
          }}
        >
          {children}
        </pre>
      )}
    </div>
  );
}
