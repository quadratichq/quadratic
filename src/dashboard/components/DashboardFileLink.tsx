import { Public } from '@mui/icons-material';
import { Box, Stack, Typography, useTheme } from '@mui/material';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  name: string;
  description: string;
  to: string;
  disabled: boolean;
  isShared: boolean;
  actions?: ReactNode;
  descriptionError?: string;
  filterValue?: string;
};

DashboardFileLink.defaultProps = {
  disabled: false,
  isShared: false,
};

export function DashboardFileLink({
  disabled,
  name,
  description,
  descriptionError,
  actions,
  to,
  isShared,
  filterValue,
}: Props) {
  const theme = useTheme();

  const __html = filterValue ? highlightMatchingString(name, filterValue) : name;

  return (
    <Link
      to={to}
      reloadDocument
      style={{
        textDecoration: 'none',
        color: 'inherit',
        ...(disabled ? { pointerEvents: 'none', opacity: 0.5 } : {}),
      }}
    >
      <Box
        sx={{
          '&:hover': { background: theme.palette.action.hover, cursor: 'pointer' },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing(2),
            px: theme.spacing(1),
            py: theme.spacing(1.5),

            [theme.breakpoints.down('md')]: {
              px: 0,
            },
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', marginRight: 'auto', minWidth: '0' }}>
            <Typography variant="body1" color="text.primary" noWrap dangerouslySetInnerHTML={{ __html }} />
            <Stack
              direction="row"
              gap={theme.spacing(0.5)}
              sx={{ '& > *:not(:last-child):after': { content: '"·"', marginLeft: theme.spacing(0.5) } }}
            >
              {isShared && (
                <Stack
                  direction="row"
                  alignItems="center"
                  gap={theme.spacing(0.25)}
                  color={theme.palette.text.secondary}
                >
                  <Public fontSize="inherit" />
                  <Typography variant="caption" color="inherit">
                    Public
                  </Typography>
                </Stack>
              )}
              <Typography variant="caption" color="text.secondary">
                {description}
              </Typography>
              {descriptionError && (
                <Typography variant="caption" color="error">
                  Test {descriptionError}
                </Typography>
              )}
            </Stack>
          </div>
          {actions}
        </Box>
      </Box>
    </Link>
  );
}

function highlightMatchingString(inputString: string, searchString: string) {
  const regex = new RegExp(searchString, 'gi'); // case insensitive matching
  const highlightedString = inputString.replace(regex, (match: string) => {
    return `<mark>${match}</mark>`;
  });
  return highlightedString;
}
