/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useContext, useEffect } from 'react';
import {
  AddCircleOutline,
  Close,
  DeleteOutline,
  FileDownloadOutlined,
  InsertDriveFileOutlined,
} from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Box,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Modal,
  Typography,
  useTheme,
} from '@mui/material';
import { useRecoilState } from 'recoil';
import FileMenuTabs from './FileMenuTabs';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { focusGrid } from '../../../helpers/focusGrid';
import { LinkNewTab } from '../../components/LinkNewTab';
import { TooltipHint } from '../../components/TooltipHint';
import {
  getStyles,
  LayoutColLeft,
  LayoutColRight,
  LayoutContainer,
  LayoutColLeftWrapper,
  LayoutColRightWrapper,
} from './FileMenuStyles';
import { useLocalFiles } from '../../../storage/useLocalFiles';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../grid/controller/sheetController';
import { DOCUMENTATION_FILES_URL } from '../../../constants/urls';
import { LocalFilesContext } from '../../QuadraticUIContext';

interface FileMenuProps {
  app: PixiApp;
  sheetController: SheetController;
}

export type onCloseFn = (arg?: { reset: boolean }) => void;

export function FileMenu(props: FileMenuProps) {
  const { app, sheetController } = props;
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { currentFileId, currentFilename, deleteFile, fileList, load, newFile } = useContext(LocalFilesContext);

  const onClose: onCloseFn = ({ reset } = { reset: false }) => {
    if (reset) {
      app.reset();
    }

    setEditorInteractionState({
      ...editorInteractionState,
      showFileMenu: false,
    });
  };
  const theme = useTheme();
  const styles = getStyles(theme);

  const onNewFile = async () => {
    await newFile();
    onClose({ reset: true });
  };

  // Focus back to the grid when this unmounts
  useEffect(() => {
    return () => {
      focusGrid();
    };
  });

  return (
    <Modal
      open={true}
      onKeyDown={(e) => {
        if (e.code === 'Escape') {
          onClose();
        }
      }}
    >
      <LayoutContainer>
        <img src="favicon.ico" width="22" alt="Quadratic logo" style={styles.logo} />
        {currentFilename && (
          <div style={styles.closeBtn}>
            <TooltipHint title="Close" shortcut={'ESC'}>
              <IconButton onClick={() => onClose()}>
                <Close />
              </IconButton>
            </TooltipHint>
          </div>
        )}

        <LayoutColLeftWrapper>
          <LayoutColLeft>
            <div>
              <Typography variant="h5">Your files</Typography>
              <List>
                <Divider />
                <ListItem key="create" disablePadding>
                  <ListItemButton sx={{ py: theme.spacing(2) }} onClick={onNewFile}>
                    <ListItemIcon>
                      <AddCircleOutline color="primary" />
                    </ListItemIcon>
                    <ListItemText primary="Create file" primaryTypographyProps={{ color: 'primary' }} />
                  </ListItemButton>
                </ListItem>
                <Divider />
                {fileList.map(({ filename, modified, id }, i) => {
                  const fileIsOpen = currentFileId === id;
                  return (
                    <div key={i}>
                      <ListItem
                        onClick={() => {
                          load(id);
                          onClose({ reset: true });
                        }}
                        secondaryAction={
                          <div style={styles.iconBtns}>
                            {!fileIsOpen && (
                              // For now we only support deleting a file that's not open
                              // one day we refactor things to support that
                              <TooltipHint title="Delete" enterDelay={1000}>
                                <IconButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Please confirm you want to delete the file “${filename}”`)) {
                                      deleteFile(id);
                                    }
                                  }}
                                >
                                  <DeleteOutline />
                                </IconButton>
                              </TooltipHint>
                            )}
                            {/* Comment this out for now
                            <TooltipHint title="Save local copy" enterDelay={1000}>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // download file
                                }}
                              >
                                <FileDownloadOutlined />
                              </IconButton>
                              </TooltipHint>*/}
                          </div>
                        }
                        disablePadding
                      >
                        <ListItemButton onClick={() => {}}>
                          <ListItemIcon>
                            <InsertDriveFileOutlined sx={{ color: theme.palette.text.primary }} />
                          </ListItemIcon>

                          <ListItemText
                            primary={
                              <>
                                {filename} {fileIsOpen && <Chip label="Open" size="small" />}
                              </>
                            }
                            secondary={timeAgo(modified)}
                          />
                        </ListItemButton>
                      </ListItem>
                      {i < fileList.length - 1 && <Divider />}
                    </div>
                  );
                })}
              </List>
            </div>
            <div>
              <Alert severity="info">
                <AlertTitle>Important note on files</AlertTitle>
                Files are stored in browser memory. Always keep a local copy saved of any important files.{' '}
                <LinkNewTab href={DOCUMENTATION_FILES_URL}>Learn more</LinkNewTab>.
              </Alert>
            </div>
          </LayoutColLeft>
        </LayoutColLeftWrapper>
        <LayoutColRightWrapper>
          <LayoutColRight>
            <Typography variant="h5">Start a new file…</Typography>
            <Divider sx={{ mt: theme.spacing(1) }} />
            <FileMenuTabs onClose={onClose} onNewFile={onNewFile} />
          </LayoutColRight>
        </LayoutColRightWrapper>
      </LayoutContainer>
    </Modal>
  );
}

// Vanilla js time formatter. Adapted from:
// https://blog.webdevsimplified.com/2020-07/relative-time-format/
const formatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
});
const DIVISIONS: { amount: number; name: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, name: 'seconds' },
  { amount: 60, name: 'minutes' },
  { amount: 24, name: 'hours' },
  { amount: 7, name: 'days' },
  { amount: 4.34524, name: 'weeks' },
  { amount: 12, name: 'months' },
  { amount: Number.POSITIVE_INFINITY, name: 'years' },
];
function timeAgo(dateNumber: number) {
  const date: Date = new Date(dateNumber);

  let duration = (date.getTime() - new Date().getTime()) / 1000;

  for (let i = 0; i < DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
}
