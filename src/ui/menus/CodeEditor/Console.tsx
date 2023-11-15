import { Box, Tab, Tabs } from '@mui/material';
import { useTheme } from '@mui/system';
import { useState } from 'react';
import { useRecoilValue } from 'recoil';
import { isViewerOrAbove } from '../../../actions';
import { EditorInteractionState, editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
// import { CodeCellRunOutput, CodeCellValue } from '../../../quadratic-core/types';
import { Circle } from '@mui/icons-material';
import { colors } from '../../../theme/colors';
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
            icon={hasOutput ? <Circle sx={{ fontSize: 8 }}></Circle> : undefined}
            iconPosition="end"
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
