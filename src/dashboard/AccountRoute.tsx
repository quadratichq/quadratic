import { Box, Typography, useTheme } from '@mui/material';
import { Form } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { useRootRouteLoaderData } from '../router';
import { Button } from '../shadcn/ui/button';
import { DashboardHeader } from './components/DashboardHeader';
// import { useColorMode } from 'shared/root/Theme';

export const Component = () => {
  const { user } = useRootRouteLoaderData();
  const theme = useTheme();
  // const { colorModePreference, toggleColorMode } = useColorMode();

  return (
    <>
      <DashboardHeader title="My account" />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: theme.spacing(3), mt: theme.spacing(3) }}>
        <Row>
          <Typography variant="body2" color="text.primary" fontWeight="bold">
            Name
          </Typography>
          <Typography variant="body2" color="text.primary">
            {user?.name}
          </Typography>
        </Row>
        <Row>
          <Typography variant="body2" color="text.primary" fontWeight="bold">
            Email
          </Typography>
          <Typography variant="body2" color="text.primary">
            {user?.email}
          </Typography>
        </Row>
        {/*
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
  </Row> */}
        <Typography variant="body2" color="text.secondary">
          Additional account management coming in the future.
        </Typography>
        <Form method="post" action={ROUTES.LOGOUT}>
          <Button variant="outline" type="submit">
            Log out
          </Button>
        </Form>
      </Box>
    </>
  );
};

function Row(props: any) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>{props.children}</Box>;
}
