import { InsertDriveFileOutlined } from '@mui/icons-material';
import { Box, Divider, Typography, useTheme } from '@mui/material';
import { ReactNode } from 'react';
import { colors } from '../../theme/colors';

export default function File({
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
    <Box sx={{ '&:hover': { background: colors.canvasLayer2, cursor: 'pointer' } }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing(2),
          padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
        }}
      >
        <div>
          <InsertDriveFileOutlined color="primary" />
        </div>
        <div style={{ marginRight: 'auto' }}>
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
      </div>
      <Divider />
    </Box>
  );
}
