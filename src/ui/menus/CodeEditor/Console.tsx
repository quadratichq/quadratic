import { Box, Tabs, Tab, Card } from '@mui/material';
import { useState } from 'react';
import { cellEvaluationReturnType } from '../../../grid/computations/types';
import { LinkNewTab } from '../../components/LinkNewTab';
import { colors } from '../../../theme/colors';
import {
  DOCUMENTATION_FORMULAS_URL,
  DOCUMENTATION_PYTHON_API_URL,
  DOCUMENTATION_PYTHON_DATA_FRAME_URL,
  DOCUMENTATION_PYTHON_URL,
} from '../../../constants/urls';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';

interface ConsoleProps {
  editorMode: EditorInteractionState['mode'];
  evalResult: cellEvaluationReturnType | undefined;
}

export function Console({ evalResult, editorMode }: ConsoleProps) {
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  const { std_err = '', std_out = '' } = evalResult || {};
  let hasOutput = Boolean(std_err.length || std_out.length);

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
              <p>
                <p>Print statements and errors are piped to the CONSOLE tab.</p>
                To return data to the grid, either the last statement from your code is returned or a special variable
                called <span style={{ color: 'grey', fontStyle: 'italic' }}>`result`</span>.
                <br />
                <br /> Example:
                <Card variant="outlined">
                  <span style={{ color: 'grey' }}>1</span> <span style={{ color: 'blue' }}>2</span> *{' '}
                  <span style={{ color: 'blue' }}>2</span>
                  <br></br>
                  <br />↳ 4 # number returned as the cell value
                </Card>
                <br />
                <br /> Example:
                <Card variant="outlined">
                  <span style={{ color: 'grey' }}>1</span> result = <span style={{ color: 'blue' }}>[]</span>
                  <br />
                  <span style={{ color: 'grey' }}>2</span> <span style={{ color: 'red' }}>for</span> x{' '}
                  <span style={{ color: 'red' }}>in </span>
                  <span style={{ color: 'blue' }}>range</span>(100):
                  <br></br>
                  <span style={{ color: 'grey' }}>3</span> {'  '}
                  result.<span style={{ color: 'blue' }}>append</span>(x)
                  <br></br>
                  <br />↳ [0, 1, 2, ..., 99] # returns 100 cells counting from 0 to 99
                </Card>
              </p>
              <p>Advanced Topics:</p>
              <p>
                Learn how to <LinkNewTab href={DOCUMENTATION_PYTHON_API_URL}>fetch data from an API.</LinkNewTab>
              </p>
              <p>
                Read about <LinkNewTab href={DOCUMENTATION_PYTHON_DATA_FRAME_URL}>using Pandas DataFrames.</LinkNewTab>
              </p>
              <p>
                <LinkNewTab href={DOCUMENTATION_PYTHON_URL}>Check out the docs</LinkNewTab> to learn more about using
                Python in Quadratic.
              </p>
            </>
          ) : (
            <>
              <p>Quadratic allows you to use the familiar spreadsheet formula language.</p>
              <p>Negative cells are referenced like `nAn2`. This is referencing cell -1, -2. Letter case matters.</p>
              <p>
                <LinkNewTab href={DOCUMENTATION_FORMULAS_URL}>Check out the docs</LinkNewTab> to learn more about using
                Formulas.
              </p>
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
