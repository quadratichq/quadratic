import {
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useState } from 'react';
import { AvatarWithLetters } from '../../components/AvatarWithLetters';
import { TeamLogoDialog, TeamLogoInput } from './TeamLogo';

export function TeamEdit({ data }: { data?: ApiTypes['/v0/teams/:uuid.GET.response'] | undefined }) {
  const theme = useTheme();
  const [name, setName] = useState<string>(data ? data.team.name : '');

  const [currentLogoUrl, setCurrentLogoUrl] = useState<string>('');
  const [userSelectedLogoUrl, setUserSelectedLogoUrl] = useState<string>('');

  // const loggedInUser: UserShare & { access: Access[] } = {
  //   id: 1,
  //   email: user?.email as string,
  //   role: RoleSchema.enum.OWNER,
  //   access: ['TEAM_EDIT', 'TEAM_DELETE', 'TEAM_BILLING_EDIT'],
  //   name: user?.name,
  //   picture: user?.picture,
  //   hasAccount: true,
  // };

  return (
    <Stack maxWidth={'30rem'} gap={theme.spacing(4)}>
      <Typography variant="body2" color="text.secondary">
        Teams are for collaborating on files with other people. Once you create a team, you can invite people to it.
      </Typography>

      <Stack direction="row" gap={theme.spacing()} alignItems="center">
        <AvatarWithLetters size="large" src={currentLogoUrl}>
          {name}
        </AvatarWithLetters>
        <Box sx={{ color: 'text.secondary' }}>
          {currentLogoUrl ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setCurrentLogoUrl('');
              }}
            >
              Remove logo
            </Button>
          ) : (
            <Button size="small" component="label" color="inherit">
              Add logo
              <TeamLogoInput onChange={(logoUrl: string) => setUserSelectedLogoUrl(logoUrl)} />
            </Button>
          )}
        </Box>
        {userSelectedLogoUrl && (
          <TeamLogoDialog
            onClose={() => setUserSelectedLogoUrl('')}
            logoUrl={userSelectedLogoUrl}
            onSave={(logoUrl: string) => {
              setCurrentLogoUrl(logoUrl);
              setUserSelectedLogoUrl('');
              // TODO window.URL.revokeObjectURL(avatarUrl) when file uploads
            }}
          />
        )}
      </Stack>
      <TextField
        inputProps={{ autoComplete: 'off' }}
        label="Name"
        // InputLabelProps={{ sx: { fontSize: '.875rem' } }}
        variant="outlined"
        autoFocus
        size="small"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <FormControl>
        <FormLabel
          id="pricing"
          sx={{
            fontSize: '.75rem',
            textIndent: theme.spacing(1),
            mb: theme.spacing(-1),
            '&.Mui-focused + div': {
              borderColor: 'transparent',
              // borderWidth: '2px',
              boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
            },
          }}
        >
          <span style={{ background: theme.palette.background.default, padding: `0 ${theme.spacing(0.5)}` }}>
            Billing
          </span>
        </FormLabel>
        <RadioGroup
          name="pricing"
          defaultValue="1"
          aria-labelledby="pricing"
          sx={{
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: theme.shape.borderRadius,
            '&:hover': {
              borderColor: theme.palette.action.active,
            },
          }}
        >
          <FormControlLabel
            value="1"
            control={<Radio />}
            disableTypography
            label={<PriceLabel primary="Beta trial" secondary="Free" />}
            sx={{ px: theme.spacing(1.5), py: theme.spacing(0), mr: 0 }}
          />

          <Divider />

          <FormControlLabel
            value="2"
            control={<Radio disabled />}
            disableTypography
            label={<PriceLabel disabled primary="Monthly" secondary="$--/usr/month" />}
            sx={{ px: theme.spacing(1.5), py: theme.spacing(0), mr: 0 }}
          />

          <Divider />

          <FormControlLabel
            value="3"
            control={<Radio disabled />}
            disableTypography
            label={<PriceLabel disabled primary="Yearly" secondary="$--/usr/year" />}
            sx={{ px: theme.spacing(1.5), py: theme.spacing(0), mr: 0 }}
          />
        </RadioGroup>
        <FormHelperText>[Note here about billing, beta plan termination date, free tier limits, etc.]</FormHelperText>
      </FormControl>

      {/* </EditTeamRow> */}
    </Stack>
  );
}

function PriceLabel({ primary, secondary, disabled }: { primary: string; secondary: string; disabled?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" flexGrow={1}>
      <Typography variant="body2" color={disabled ? 'text.disabled' : 'text.primary'}>
        {primary}
      </Typography>
      <Typography variant="body2" color={disabled ? 'text.disabled' : 'text.secondary'}>
        {secondary}
      </Typography>
    </Stack>
  );
}
