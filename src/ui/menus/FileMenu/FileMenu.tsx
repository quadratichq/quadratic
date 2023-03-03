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
import { useEffect } from 'react';

interface FileMenuProps {
  app: any;
  sheetController: any;
}

export function FileMenu(props: FileMenuProps) {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const onClose = () => {
    setEditorInteractionState({
      ...editorInteractionState,
      showFileMenu: false,
    });
    focusGrid();
  };
  const theme = useTheme();

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

  // Focus back to the grid when this unmounts
  useEffect(() => {
    return () => {
      focusGrid();
    };
  });

  const colStyles: React.CSSProperties = {
    maxWidth: '40rem',
    margin: `${theme.spacing(6)} auto`,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  };

  return (
    <Modal
      open={true}
      onKeyDown={(e) => {
        if (e.code === 'Escape') {
          onClose();
        }
        console.log('fired');
      }}
    >
      <Box
        style={{
          position: 'fixed',
          width: '100%',
          height: '100%',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          background: '#fff',
          zIndex: '100',
          display: 'grid',
          gridTemplateColumns: '50% 50%',
          overflow: 'scroll',
        }}
      >
        <img
          src="/images/logo.svg"
          width="17"
          alt="Quadratic logo"
          style={{ position: 'fixed', left: theme.spacing(2), top: theme.spacing(2) }}
        />
        <div style={{ position: 'fixed', right: theme.spacing(1), top: theme.spacing(1) }}>
          <TooltipHint title="Close" shortcut={'ESC'}>
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </TooltipHint>
        </div>

        <div style={colStyles}>
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
              {files.length ? (
                files.map(({ name, modified }, i) => (
                  <>
                    <ListItem
                      key={i}
                      secondaryAction={
                        <div style={{ display: 'flex', alignItems: 'ceter', gap: '8px' }}>
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
                        <ListItemText primary={name} secondary={timeAgo(new Date(modified))} />
                      </ListItemButton>
                    </ListItem>
                    {i < files.length - 1 && <Divider />}
                  </>
                ))
              ) : (
                <ListItem disabled>
                  <ListItemText primary="There are no files stored in memory." />
                </ListItem>
              )}
            </List>
          </div>
          <div>
            <Alert severity="info">
              <AlertTitle>Important note on files</AlertTitle>
              Files are stored in memory. Make sure you save a local copy of any files you want to save.{' '}
              <LinkNewTab href="#TODO-DOCS-LINK">Learn more</LinkNewTab>.
            </Alert>
          </div>
        </div>
        <div style={{ background: theme.palette.grey['50'] }}>
          <div style={colStyles}>
            <Typography variant="h5">Start a new file…</Typography>
            <Divider sx={{ mt: theme.spacing(1) }} />
            <FileMenuTabs />
          </div>
        </div>
      </Box>
    </Modal>
  );
}

// TODO quick and dirty, pulled from here
// https://blog.webdevsimplified.com/2020-07/relative-time-format/
// Maybe can do this with vanilla js, maybe need a lib
const formatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
});

const DIVISIONS = [
  { amount: 60, name: 'seconds' },
  { amount: 60, name: 'minutes' },
  { amount: 24, name: 'hours' },
  { amount: 7, name: 'days' },
  { amount: 4.34524, name: 'weeks' },
  { amount: 12, name: 'months' },
  { amount: Number.POSITIVE_INFINITY, name: 'years' },
];

function timeAgo(date: Date) {
  // @ts-ignore
  let duration = (date - new Date()) / 1000;

  for (let i = 0; i < DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    if (Math.abs(duration) < division.amount) {
      // @ts-ignore
      return formatter.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
}
