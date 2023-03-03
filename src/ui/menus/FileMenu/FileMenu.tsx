import { Add, Close, Delete, FileDownloadOutlined } from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Button,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  useTheme,
} from '@mui/material';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { focusGrid } from '../../../helpers/focusGrid';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { LinkNewTab } from '../../components/LinkNewTab';
import { TooltipHint } from '../../components/TooltipHint';

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

  return (
    <div
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
        style={{ position: 'fixed', left: theme.spacing(1), top: theme.spacing(1) }}
      />
      <div style={{ position: 'fixed', right: theme.spacing(1), top: theme.spacing(1) }}>
        <TooltipHint title="Close file menu" shortcut={KeyboardSymbols.Command + 'O'}>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </TooltipHint>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          maxWidth: '40rem',
          padding: theme.spacing(1, 0, 0, 0),
          margin: `0 auto`,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: theme.spacing(4),
            }}
          >
            <Typography variant="h5">Files</Typography>
            <Button
              variant="text"
              startIcon={<Add />}
              onClick={() => {
                // TODO create new file
              }}
            >
              Create new
            </Button>
          </div>

          <Divider sx={{ mt: theme.spacing(1), mb: theme.spacing(-1) }} />

          <List>
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
                          <FileDownloadOutlined fontSize="small" />
                        </IconButton>
                        <IconButton
                          onClick={() => {
                            // TODO delete file from memory
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </div>
                    }
                    disablePadding
                    style={{ borderBottom: `1px solid ${theme.palette.divider}` }}
                  >
                    <ListItemButton onClick={() => {}}>
                      <ListItemText primary={name} secondary={timeAgo(new Date(modified))} />
                    </ListItemButton>
                  </ListItem>
                </>
              ))
            ) : (
              <>
                <ListItem disabled>
                  <ListItemText primary="There are no files stored in memory." />
                </ListItem>
              </>
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
        <div style={{ maxWidth: '40rem', padding: theme.spacing(1, 0, 0, 0), margin: `0 auto` }}>
          <Typography variant="h5">Open file…</Typography>
        </div>
      </div>
    </div>
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
