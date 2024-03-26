import { Box, Tab, Tabs, useTheme } from '@mui/material';
import { useState } from 'react';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { Coordinate } from '@/gridGL/types/size';
import { useRootRouteLoaderData } from '@/router';
import { EvaluationResult } from '@/web-workers/pythonWebWorker/pythonTypes';
import { Circle } from '@mui/icons-material';
import { colors } from '../../../theme/colors';
import { AITab } from './AITab';
import { codeEditorBaseStyles, codeEditorCommentStyles } from './styles';

interface ConsoleProps {
  consoleOutput?: { stdOut?: string; stdErr?: string };
  editorMode: EditorInteractionState['mode'];
  editorContent: string | undefined;
  evaluationResult?: EvaluationResult;
  spillError?: Coordinate[];
}

export function Console({ consoleOutput, editorMode, editorContent, evaluationResult, spillError }: ConsoleProps) {
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  const theme = useTheme();
  const { isAuthenticated } = useRootRouteLoaderData();
  let hasOutput = Boolean(consoleOutput?.stdErr?.length || consoleOutput?.stdOut?.length || spillError);

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
            icon={
              hasOutput ? (
                <Circle sx={{ fontSize: 8 }} color={consoleOutput?.stdErr ? 'error' : 'inherit'} />
              ) : undefined
            }
            iconPosition="end"
          ></Tab>
          {editorMode === 'Python' && isAuthenticated && (
            <Tab
              style={{ minHeight: '32px' }}
              label="AI Assistant"
              id="console-tab-1"
              aria-controls="console-tabpanel-1"
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
                {spillError && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.error }}>
                    SPILL ERROR: Array output could not expand because it would overwrite existing content. To fix this,
                    remove content in cell
                    {spillError.length > 1 ? 's' : ''}{' '}
                    {spillError.map(
                      (pos, index) =>
                        `(${pos.x}, ${pos.y})${
                          index !== spillError.length - 1 ? (index === spillError.length - 2 ? ', and ' : ', ') : '.'
                        }`
                    )}
                  </span>
                )}
                {consoleOutput?.stdErr && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.error }}>
                    ERROR: {consoleOutput?.stdErr}
                  </span>
                )}
                {consoleOutput?.stdOut}
              </>
            ) : (
              <div style={{ ...codeEditorCommentStyles, marginTop: theme.spacing(0.5) }}>
                {editorMode === 'Python'
                  ? 'Print statements, standard out, and errors will show here.'
                  : 'Errors will show here.'}
              </div>
            )}
          </div>
        </TabPanel>
        <TabPanel value={activeTabIndex} index={1}>
          <AITab
            // todo: fix this
            evalResult={evaluationResult}
            editorMode={editorMode}
            editorContent={editorContent}
            isActive={activeTabIndex === 1}
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
