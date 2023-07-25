import { InsertDriveFileOutlined } from '@mui/icons-material';
import { Box, Divider, Typography, useTheme } from '@mui/material';
import { Link } from 'react-router-dom';
import { colors } from '../theme/colors';
import { ReactNode } from 'react';

export default function File({
  to,
  name,
  description,
  actions,
  status,
}: {
  to: string;
  name: string;
  description: string;
  actions?: ReactNode;
  status?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Box sx={{ '&:hover': { background: colors.canvasLayer2 } }}>
      <Link
        to={to}
        reloadDocument
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing(2),
          padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
          textDecoration: 'none',
          color: 'inherit',
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
      </Link>
      <Divider />
    </Box>
  );
}
