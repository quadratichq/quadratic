import * as React from 'react';
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
import { openExampleGridFile } from '../../../grid/actions/gridFile/OpenGridFile';
import { SheetController } from '../../../grid/controller/sheetController';
import { InsertDriveFileOutlined } from '@mui/icons-material';
import { LinkNewTab } from '../../components/LinkNewTab';

// TODO work on descriptions
const examples = [
  { name: 'Basic', file: 'default.grid', description: 'Quick start' },
  {
    name: 'Using Python',
    file: 'python.grid',
    description: 'Basics of using Python like returning data to the grid and making API requests.',
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
  children?: React.ReactNode;
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
      {value === index && (
        <Box sx={{ px: 0, py: 2 }}>
          <Typography>{children}</Typography>
        </Box>
      )}
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
  const [value, setValue] = React.useState(0);
  const theme = useTheme();

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

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
        <Tab label="Import" {...a11yProps(2)} />
        <Tab label="URL" {...a11yProps(3)} />
      </Tabs>
      <TabPanel value={value} index={0}>
        <Typography variant="body1" sx={{ mb: theme.spacing(2) }}>
          Quadratic spreadsheets are an open `.grid` file format. They can be saved to your local computer for sharing
          with others and re-opened here.
        </Typography>
        <Button variant="contained" disableElevation>
          New file
        </Button>
      </TabPanel>
      <TabPanel value={value} index={1}>
        <List sx={{ mt: theme.spacing(-3) }}>
          {examples.map(({ name, file, description }, i) => (
            <>
              <ListItem key={`sample-${file}`} disablePadding>
                <ListItemButton
                  onClick={() => {
                    openExampleGridFile(file, sheetController);
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
            </>
          ))}
        </List>
      </TabPanel>
      <TabPanel value={value} index={2}>
        <Typography variant="body1" sx={{ mb: theme.spacing(2) }}>
          Quadratic spreadsheets are an open `.grid` file format that can be saved to your local computer and re-opened
          here.
        </Typography>
        <Button
          disableElevation
          variant="contained"
          onClick={() => {
            // TODO
            // trigger native file picker
            // process selected file
            // if valid, load it into the grid and close this menu
            // if not valid, display an error with help
          }}
        >
          Select file & open
        </Button>
        <Typography variant="body2" color="error" mt={theme.spacing(1)}>
          The file you chose doesn’t appear to be a valid `.grid` file. Try again.
        </Typography>
      </TabPanel>
      <TabPanel value={value} index={3}>
        <Typography gutterBottom>
          You can store `.grid` files on remote file servers and open them for editing in Quadratic by using the `file`
          parameter in the URL. For example:
        </Typography>
        <Typography gutterBottom>
          <code>https://app.quadratichq.com?file=https://example.com/my-file.grid</code>
        </Typography>
        <Typography gutterBottom mt={theme.spacing(4)} mb={theme.spacing(1)}>
          Or, paste a URL to a grid file below.
        </Typography>
        <TextField
          id="url"
          label="File URL"
          variant="outlined"
          placeholder="https://example.com/my-file.grid"
          fullWidth
          autoFocus
        />
        <Button variant="contained" disableElevation sx={{ mt: theme.spacing(1) }}>
          Open File
        </Button>
        <Typography color="error" mt={theme.spacing(1)}>
          Failed to import that file to Quadratic. Ensure{' '}
          <LinkNewTab href="#TODO" color="inherit">
            you can retrieve the remotely-hosted file
          </LinkNewTab>{' '}
          and try again.
        </Typography>
      </TabPanel>
    </Box>
  );
}
