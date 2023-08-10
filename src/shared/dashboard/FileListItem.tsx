import { InsertDriveFileOutlined } from '@mui/icons-material';
import { Box, Divider, Typography, useTheme } from '@mui/material';
import { ReactNode } from 'react';

export default function FileListItem({
  name,
  description,
  actions,
  status,
}: {
  name: string;
  description: string;
  actions?: ReactNode;
  status?: ReactNode;
}) {
  const theme = useTheme();

  return (
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

          [theme.breakpoints.down('md')]: {
            p: theme.spacing(1),
          },

          [theme.breakpoints.up('md')]: {
            p: theme.spacing(2),
          },
        }}
      >
        <div className="FileListItem-icon">
          <InsertDriveFileOutlined />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginRight: 'auto' }}>
          <div style={{ display: 'flex', gap: theme.spacing() }}>
            <Typography variant="body1" color="text.primary">
              {name}
            </Typography>
            {status && status}
          </div>
          <Typography variant="caption" color="text.secondary">
            {description}
          </Typography>
        </div>
        {actions}
      </Box>
      <Divider />
    </Box>
  );
}
