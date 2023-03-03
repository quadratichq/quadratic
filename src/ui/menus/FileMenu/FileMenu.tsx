import { useEffect } from 'react';
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
import { getStyles } from './FileMenuStyles';

// TODO accomodate really long names with the two icons
const files = [
  { name: 'Untitled', modified: '2023-03-02T22:01:43.892Z' },
  { name: 'Python', modified: '2023-03-01T12:03:13.892Z' },
  {
    name: 'my_file_name_here',
    modified: '2023-01-02T15:22:43.892Z',
  },
  { name: 'Untitled', modified: '2021-03-01T12:03:13.892Z' },
];

interface FileMenuProps {
  app: any;
  sheetController: any;
}

export function FileMenu(props: FileMenuProps) {
  const { sheetController } = props;
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const onClose = () => {
    setEditorInteractionState({
      ...editorInteractionState,
      showFileMenu: false,
    });
  };
  const theme = useTheme();
  const styles = getStyles(theme);

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
      <Box style={styles.container}>
        <img src="/images/logo.svg" width="17" alt="Quadratic logo" style={styles.logo} />
        <div style={styles.closeBtn}>
          <TooltipHint title="Close" shortcut={'ESC'}>
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </TooltipHint>
        </div>

        <div style={styles.cols}>
          <div>
            <Typography variant="h5">Your files</Typography>
            <List>
              <Divider />
              <ListItem disablePadding>
                <ListItemButton sx={{ py: theme.spacing(2) }}>
                  <ListItemIcon>
                    <AddCircleOutline color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="Create file" primaryTypographyProps={{ color: 'primary' }} />
                </ListItemButton>
              </ListItem>
              <Divider />
              {files.map(({ name, modified }, i) => (
                <>
                  <ListItem
                    key={i}
                    secondaryAction={
                      <div style={styles.iconBtns}>
                        <IconButton
                          onClick={() => {
                            // TODO download file
                          }}
                        >
                          <FileDownloadOutlined />
                        </IconButton>
                        <IconButton
                          onClick={() => {
                            // TODO delete file from memory
                          }}
                        >
                          <DeleteOutline />
                        </IconButton>
                      </div>
                    }
                    disablePadding
                  >
                    <ListItemButton onClick={() => {}}>
                      <ListItemIcon>
                        <InsertDriveFileOutlined sx={{ color: theme.palette.text.primary }} />
                      </ListItemIcon>
                      <ListItemText primary={name} secondary={timeAgo(modified)} />
                    </ListItemButton>
                  </ListItem>
                  {i < files.length - 1 && <Divider />}
                </>
              ))}
            </List>
          </div>
          <div>
            <Alert severity="info">
              <AlertTitle>Important note on files</AlertTitle>
              Files are stored in browser memory. Always keep a local copy saved of any important files.{' '}
              <LinkNewTab href="#TODO-DOCS-LINK">Learn more</LinkNewTab>.
            </Alert>
          </div>
        </div>
        <div style={{ background: theme.palette.grey['50'] }}>
          <div style={styles.cols}>
            <Typography variant="h5">Start a new file…</Typography>
            <Divider sx={{ mt: theme.spacing(1) }} />
            <FileMenuTabs sheetController={sheetController} onClose={onClose} />
          </div>
        </div>
      </Box>
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
function timeAgo(dateIsoString: string) {
  const date: Date = new Date(dateIsoString);

  let duration = (date.getTime() - new Date().getTime()) / 1000;

  for (let i = 0; i < DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
}
