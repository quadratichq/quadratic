import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { Button, useTheme } from '@mui/material';

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

export default function BasicTabs() {
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
        Remote
      </TabPanel>
      <TabPanel value={value} index={2}>
        <Typography variant="body1" sx={{ mb: theme.spacing(2) }}>
          Quadratic spreadsheets are an open `.grid` file format. They can be saved to your local computer for sharing
          with others and re-opened here.
        </Typography>
        <Button
          variant="outlined"
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
      </TabPanel>
      <TabPanel value={value} index={3}>
        URL
      </TabPanel>
    </Box>
  );
}
