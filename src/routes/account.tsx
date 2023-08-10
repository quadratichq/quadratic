import { Box, Button, ButtonGroup, Typography, useTheme } from '@mui/material';
import { ROUTES } from 'constants/routes';
import { Form, useRouteLoaderData } from 'react-router-dom';
import { RootLoaderData } from 'routes';
import Header from 'shared/dashboard/Header';
import { useColorMode } from 'shared/root/Theme';

export const Component = () => {
  const { user } = useRouteLoaderData('root') as RootLoaderData;
  const theme = useTheme();
  const { colorModePreference, toggleColorMode } = useColorMode();

  return (
    <>
      <Header title="My account" />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: theme.spacing(3), mt: theme.spacing(3) }}>
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
        <Form method="post" action={ROUTES.LOGOUT}>
          <Button variant="outlined" type="submit">
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
