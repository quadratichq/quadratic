import { Box, Tabs, Tab } from '@mui/material';
import { useState } from 'react';
import { cellEvaluationReturnType } from '../../../grid/computations/types';
import { LinkNewTab } from '../../components/LinkNewTab';
import { colors } from '../../../theme/colors';
import { DOCUMENTATION_FORMULAS_URL, DOCUMENTATION_PYTHON_URL } from '../../../constants/urls';
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
          <Tab style={{ minHeight: '32px' }} label="Output" id="console-tab-0" aria-controls="console-tabpanel-0"></Tab>
          <Tab style={{ minHeight: '32px' }} label="About" id="console-tab-1" aria-controls="console-tabpanel-1"></Tab>
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
              <p>Quadratic allows you to leverage the power of Python to fetch, script, and compute cell data.</p>
              <p>
                <LinkNewTab href="https://pandas.pydata.org/">Pandas</LinkNewTab>,{' '}
                <LinkNewTab href="https://numpy.org/">NumPy</LinkNewTab>, and{' '}
                <LinkNewTab href="https://scipy.org/">SciPy</LinkNewTab> libraries are included by default.{' '}
                <LinkNewTab href="https://github.com/pyodide/micropip">Micropip</LinkNewTab> is also available for
                installing any third-party libraries you need.
              </p>
              <p>
                <LinkNewTab href={DOCUMENTATION_PYTHON_URL}>Check out the docs</LinkNewTab> to learn more about using
                Python.
              </p>
            </>
          ) : (
            <>
              <p>Quadratic allows you to use the familiar spreadsheet formula language.</p>
              <p>Negative cells are referenced like `ZAn2`. This is referencing cell -1, -2. Letter case matters.</p>
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
