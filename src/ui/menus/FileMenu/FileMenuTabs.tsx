import { styled } from '@mui/material/styles';
import {
  Button,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  useTheme,
  Tab,
  Tabs as TabsMUI,
  Typography,
  Box,
  Backdrop,
} from '@mui/material';
import { InsertDriveFileOutlined } from '@mui/icons-material';
import { LinkNewTab } from '../../components/LinkNewTab';
import { ChangeEvent, ReactNode, SyntheticEvent, useCallback, useRef, useState } from 'react';
import { DOCUMENTATION_FILES_URL } from '../../../constants/urls';
import { QuadraticLoading } from '../../loading/QuadraticLoading';
import { EXAMPLE_FILES } from '../../../constants/app';
import { useLocalFiles } from '../../contexts/LocalFiles';

interface TabPanelProps {
  children?: ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ px: 0, py: 2 }}>{children}</Box>}
    </div>
  );
}

const Tabs = styled(TabsMUI)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,

  [theme.breakpoints.up('lg')]: {
    borderBottom: 'none',
    position: 'absolute',
    top: theme.spacing(-1),
    right: '0',
  },
}));

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

interface FileMenuTabsProps {
  onClose: () => void;
  onNewFile: () => void;
}

export default function FileMenuTabs(props: FileMenuTabsProps) {
  const { onClose, onNewFile } = props;
  const [value, setValue] = useState(0);
  const [importLocalError, setImportLocalError] = useState<boolean>(false);
  const [importURLError, setImportURLError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const importURLInput = useRef<HTMLInputElement | null>(null);
  const theme = useTheme();
  const { loadFileFromDisk, loadFileFromUrl, loadFileFromExamples } = useLocalFiles();
  const importFileButton = useRef<HTMLInputElement | null>(null);

  const importFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = e.target.files?.[0];
      if (file) {
        const loaded = await loadFileFromDisk(file);
        if (loaded) onClose();
        else setImportLocalError(true);
      }
    },
    [loadFileFromDisk, onClose]
  );

  const importURL = useCallback(
    async (e): Promise<void> => {
      e.preventDefault();
      const url = importURLInput.current?.value;
      if (url) {
        setIsLoading(true);
        const loaded = await loadFileFromUrl(url);
        setIsLoading(false);
        if (loaded) onClose();
        else setImportURLError(true);
      }
    },
    [loadFileFromUrl, onClose]
  );

  const handleChange = useCallback((event: SyntheticEvent, newValue: number) => {
    setValue(newValue);
  }, []);

  return (
    <Box sx={{ width: '100%' }}>
      <Backdrop
        open={isLoading}
        style={{
          background: 'rgba(255,255,255,.95)',
          zIndex: '1000',
        }}
      >
        <QuadraticLoading />
      </Backdrop>

      <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
        <Tab label="Blank" {...a11yProps(0)} />
        <Tab label="Example" {...a11yProps(1)} />
        <Tab label="Local" {...a11yProps(2)} />
        <Tab label="Remote" {...a11yProps(3)} />
      </Tabs>
      <TabPanel value={value} index={0}>
        <Typography variant="body1" sx={{ mb: theme.spacing(2) }}>
          Quadratic spreadsheets use an open <code>.grid</code> file format that be saved to your local computer, shared
          with others, and re-opened here.{' '}
          <LinkNewTab href={DOCUMENTATION_FILES_URL} color="inherit">
            Learn more
          </LinkNewTab>
          .
        </Typography>
        <Button variant="contained" disableElevation onClick={onNewFile}>
          Create file
        </Button>
      </TabPanel>
      <TabPanel value={value} index={1}>
        <Typography variant="body1" sx={{ mb: theme.spacing(2) }}>
          Example files can help teach you how to use different features of Quadratic.
        </Typography>
        <Divider />
        <List sx={{ mt: theme.spacing(-1) }}>
          {EXAMPLE_FILES.map(({ name, file, description }, i) => (
            <div key={i}>
              <ListItem key={`sample-${file}`} disablePadding>
                <ListItemButton
                  onClick={() => {
                    setIsLoading(true);
                    loadFileFromExamples(file, name)
                      .then((loaded) => {
                        setIsLoading(false);
                        if (loaded) {
                          onClose();
                        }
                      })
                      .catch((e) => {
                        console.error(e);
                        setIsLoading(false);
                      });
                  }}
                >
                  <ListItemIcon>
                    <InsertDriveFileOutlined sx={{ color: theme.palette.text.primary }} />
                  </ListItemIcon>
                  <ListItemText primary={name} secondary={description} />
                </ListItemButton>
              </ListItem>
              {i < EXAMPLE_FILES.length - 1 && <Divider />}
            </div>
          ))}
        </List>
      </TabPanel>
      <TabPanel value={value} index={2}>
        <Typography variant="body1" sx={{ mb: theme.spacing(2) }}>
          Import a local <code>.grid</code> file from your computer into browser memory.
        </Typography>
        <input type="file" ref={importFileButton} style={{ display: 'none' }} accept=".grid" onChange={importFile} />
        <Button disableElevation variant="contained" onClick={() => importFileButton.current?.click()}>
          Select file & import
        </Button>
        {importLocalError && (
          <Typography variant="body2" color="error" mt={theme.spacing(1)}>
            The file you chose doesn’t appear to be a valid <code>.grid</code> file. Try again.
          </Typography>
        )}
      </TabPanel>
      <TabPanel value={value} index={3}>
        <Typography gutterBottom>
          Import a remote <code>.grid</code> file from a server into browser memory using the <code>file</code>{' '}
          parameter in the URL. For example:
        </Typography>
        <Typography gutterBottom>
          <code>https://app.quadratichq.com?file=https://example.com/my-file.grid</code>
        </Typography>
        <Typography gutterBottom mt={theme.spacing(4)} mb={theme.spacing(2)}>
          Or, paste a URL to a <code>.grid</code> file to import it:
        </Typography>
        <form onSubmit={importURL}>
          <TextField
            inputRef={importURLInput}
            id="url"
            label="File URL"
            variant="outlined"
            placeholder="https://example.com/my-file.grid"
            fullWidth
            autoFocus
          />
          <Button type="submit" variant="contained" disableElevation sx={{ mt: theme.spacing(1) }}>
            Import file
          </Button>
        </form>
        {importURLError && (
          <Typography color="error" mt={theme.spacing(1)}>
            Failed to import that file to Quadratic. Ensure{' '}
            <LinkNewTab href={DOCUMENTATION_FILES_URL} color="inherit">
              you can retrieve the remotely-hosted file
            </LinkNewTab>{' '}
            and try again.
          </Typography>
        )}
      </TabPanel>
    </Box>
  );
}
