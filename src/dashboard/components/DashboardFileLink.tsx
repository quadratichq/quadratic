import { InsertDriveFileOutlined } from '@mui/icons-material';
import { Box, Stack, Typography, useTheme } from '@mui/material';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShareFileOutlined } from '../../ui/icons';

type Props = {
  name: string;
  description: string;
  to: string;
  disabled: boolean;
  isShared: boolean;
  actions?: ReactNode;
  descriptionError?: string;
};

DashboardFileLink.defaultProps = {
  disabled: false,
  isShared: false,
};

export function DashboardFileLink({ disabled, name, description, descriptionError, actions, to, isShared }: Props) {
  const theme = useTheme();

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
          '.FileListItem-icon svg': {
            fill: theme.palette.text.secondary,
          },
          '&:hover .FileListItem-icon svg': {
            fill: theme.palette.text.primary,
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing(2),
            p: theme.spacing(1.5),

            [theme.breakpoints.down('md')]: {
              px: 0,
            },
          }}
        >
          <div className="FileListItem-icon">{isShared ? <ShareFileOutlined /> : <InsertDriveFileOutlined />}</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginRight: 'auto', minWidth: '0' }}>
            <Typography variant="body1" color="text.primary" noWrap>
              {name}
            </Typography>
            <Stack
              direction="row"
              gap={theme.spacing(0.5)}
              sx={{ '& > *:not(:last-child):after': { content: '"·"', marginLeft: theme.spacing(0.5) } }}
            >
              {isShared && (
                <Typography variant="caption" color="text.secondary">
                  Public
                </Typography>
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
