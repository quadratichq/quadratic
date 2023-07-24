import PaneHeader from './PaneHeader';
import { ColorModeContext } from '../quadratic/Theme';
import { useContext } from 'react';
import { Box, Button, ButtonGroup, Typography, useTheme } from '@mui/material';
import { RootLoaderData } from '../Routes';
import { useRouteLoaderData } from 'react-router-dom';

export const Component = () => {
  const { user } = useRouteLoaderData('root') as RootLoaderData;

  const { colorModePreference, toggleColorMode } = useContext(ColorModeContext);
  return (
    <>
      <PaneHeader title="Account" />
      <Row>
        <Typography variant="body1" color="text.primary" fontWeight="bold">
          Name
        </Typography>
        <Typography variant="body1" color="text.primary">
          {user?.name}
        </Typography>
      </Row>
      <Row>
        <Typography variant="body1" color="text.primary" fontWeight="bold">
          Email
        </Typography>
        <Typography variant="body1" color="text.primary">
          {user?.email}
        </Typography>
      </Row>
      <Row>
        <Typography variant="body1" color="text.primary" fontWeight="bold">
          Theme
        </Typography>
        <ButtonGroup disableElevation variant="outlined" aria-label="Disabled elevation buttons">
          <Button
            variant={colorModePreference === 'light' ? 'contained' : 'outlined'}
            onClick={() => toggleColorMode('light')}
          >
            Light
          </Button>
          <Button
            variant={colorModePreference === 'dark' ? 'contained' : 'outlined'}
            onClick={() => toggleColorMode('dark')}
          >
            Dark
          </Button>
          <Button
            variant={colorModePreference === 'system' ? 'contained' : 'outlined'}
            onClick={() => toggleColorMode('system')}
          >
            System
          </Button>
        </ButtonGroup>
      </Row>
      <Typography variant="body2" color="text.secondary">
        Additional account management coming in the future.
      </Typography>
    </>
  );
};

function Row(props: any) {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', my: theme.spacing(3) }}>
      {props.children}
    </Box>
  );
}
