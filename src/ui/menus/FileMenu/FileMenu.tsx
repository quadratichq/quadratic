import { useEffect } from 'react';
import * as Sentry from '@sentry/browser';
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
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { DOCUMENTATION_FILES_URL } from '../../../constants/urls';
import { useLocalFiles } from '../../contexts/LocalFiles';
import { useGlobalSnackbar } from '../../contexts/GlobalSnackbar';

interface FileMenuProps {
  app: PixiApp;
}

export type onCloseFn = (arg?: { reset: boolean }) => void;

export function FileMenu(props: FileMenuProps) {
  const { app } = props;
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const {
    currentFileId,
    currentFilename,
    deleteFile,
    downloadFileFromMemory,
    fileList,
    loadFileFromMemory,
    createNewFile,
  } = useLocalFiles();
  const { addGlobalSnackbar } = useGlobalSnackbar();

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
    await createNewFile();
    onClose({ reset: true });
  };

  // If there's an active file, set focus back to the grid when this unmounts
  useEffect(() => {
    return () => {
      if (currentFileId) {
        focusGrid();
      }
    };
  });

  return (
    <Modal
      open={true}
      onKeyDown={(e) => {
        // Only close if there's an active sheet
        if (e.code === 'Escape' && currentFileId) {
          onClose();
        }
      }}
    >
      <LayoutContainer>
        <div style={styles.logo}>
          <img src="favicon.ico" width="22" alt="Quadratic logo" />
        </div>
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
              <Typography variant="h5">Files stored in browser memory</Typography>
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
                          loadFileFromMemory(id).then((loaded) => {
                            if (loaded) {
                              onClose({ reset: true });
                            } else {
                              addGlobalSnackbar('Failed to load file.');
                              Sentry.captureEvent({
                                message: 'User file became corrupted',
                                level: Sentry.Severity.Critical,
                                // TODO send along the corrupted file
                                // extra: { file: ... }
                              });
                            }
                          });
                        }}
                        secondaryAction={
                          <div style={styles.iconBtns}>
                            {!fileIsOpen && (
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
                            <TooltipHint title="Download local copy" enterDelay={1000}>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadFileFromMemory(id);
                                }}
                              >
                                <FileDownloadOutlined />
                              </IconButton>
                            </TooltipHint>
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
            <div style={{ paddingBottom: '1rem' }}>
              <Alert severity="info">
                <AlertTitle>Important note on files</AlertTitle>
                Files are stored in your browser’s memory. Always download a local copy of any important files. In the
                future files will be collaborative in the cloud.{' '}
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
