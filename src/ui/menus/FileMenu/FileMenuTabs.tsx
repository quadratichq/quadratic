import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
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
} from '@mui/material';
import { SheetController } from '../../../grid/controller/sheetController';
import { InsertDriveFileOutlined } from '@mui/icons-material';
import { LinkNewTab } from '../../components/LinkNewTab';
import { useLocalFiles } from '../../../storage/useLocalFiles';
import { ChangeEvent, ReactNode, SyntheticEvent, useCallback, useRef, useState } from 'react';
import { DOCUMENTATION_FILES_URL } from '../../../constants/urls';

// TODO work on descriptions
const examples = [
  {
    name: 'Quick start',
    description: 'Intro to the basics of using Quadratic.',
    file: 'default.grid',
  },
  {
    name: 'Using Python',
    file: 'python.grid',
    description: 'Returning data to the grid, making API requests, and more.',
  },
  { name: 'Airports (large)', file: 'airports_large.grid', description: 'Lorem ipsum santa dolor.' },
  { name: 'Airports (distance)', file: 'airport_distance.grid', description: 'Lorem ipsum santa dolor.' },
  { name: 'Expenses', file: 'expenses.grid', description: 'Example of spreadsheet-style budgeting.' },
  {
    name: 'Monte Carlo simulation',
    file: 'monte_carlo_simulation.grid',
    description: 'Working with large sets of data',
  },
  { name: 'Startup portfolio', file: 'startup_portfolio.grid', description: 'Lorem ipsum santa dolor.' },
];

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

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

interface FileMenuTabsProps {
  sheetController: SheetController;
  onClose: () => void;
}

export default function FileMenuTabs(props: FileMenuTabsProps) {
  const { onClose, sheetController } = props;
  const [value, setValue] = useState(0);
  const [importLocalError, setImportLocalError] = useState(false);
  const [importURLError, setImportURLError] = useState(false);
  const importURLInput = useRef<HTMLInputElement | null>(null);
  const theme = useTheme();
  const { loadSample, newFile, importLocalFile, loadQuadraticFile } = useLocalFiles(sheetController);
  const importFileButton = useRef<HTMLInputElement | null>(null);

  const importFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = e.target.files?.[0];
      if (file) {
        const loaded = await importLocalFile(file);
        if (loaded) onClose();
        else setImportLocalError(true);
      }
    },
    [importLocalFile, onClose]
  );

  const importURL = useCallback(async (): Promise<void> => {
    const url = importURLInput.current?.value;
    if (url) {
      const loaded = await loadQuadraticFile(url);
      if (loaded) onClose();
      else setImportURLError(true);
    }
  }, [loadQuadraticFile, onClose]);

  const handleChange = useCallback((event: SyntheticEvent, newValue: number) => {
    setValue(newValue);
  }, []);

  return (
    <Box sx={{ width: '100%' }}>
      <Tabs
        value={value}
        onChange={handleChange}
        aria-label="basic tabs example"
        style={{ position: 'absolute', top: theme.spacing(-1), right: '0' }}
      >
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
        <Button
          variant="contained"
          disableElevation
          onClick={() => {
            newFile();
            onClose();
          }}
        >
          Create file
        </Button>
      </TabPanel>
      <TabPanel value={value} index={1}>
        <Typography variant="body1" sx={{ mb: theme.spacing(2) }}>
          Example files can help teach you how to use different features of Quadratic.
        </Typography>
        <Divider />
        <List sx={{ mt: theme.spacing(-1) }}>
          {examples.map(({ name, file, description }, i) => (
            <div key={i}>
              <ListItem key={`sample-${file}`} disablePadding>
                <ListItemButton
                  onClick={async () => {
                    await loadSample(file);
                    onClose();
                  }}
                >
                  <ListItemIcon>
                    <InsertDriveFileOutlined sx={{ color: theme.palette.text.primary }} />
                  </ListItemIcon>
                  <ListItemText primary={name} secondary={description} />
                </ListItemButton>
              </ListItem>
              {i < examples.length - 1 && <Divider />}
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
            The file you chose doesn’t appear to be a valid `.grid` file. Try again.
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
        <TextField
          inputRef={importURLInput}
          id="url"
          label="File URL"
          variant="outlined"
          placeholder="https://example.com/my-file.grid"
          fullWidth
          autoFocus
        />
        <Button variant="contained" disableElevation sx={{ mt: theme.spacing(1) }} onClick={importURL}>
          Import file
        </Button>
        {importURLError && (
          <Typography color="error" mt={theme.spacing(1)}>
            Failed to import that file to Quadratic. Ensure{' '}
            <LinkNewTab href="#TODO" color="inherit">
              you can retrieve the remotely-hosted file
            </LinkNewTab>{' '}
            and try again.
          </Typography>
        )}
      </TabPanel>
    </Box>
  );
}
