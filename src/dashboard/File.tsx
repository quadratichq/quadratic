import { InsertDriveFileOutlined } from '@mui/icons-material';
import { Box, Divider, Typography, useTheme } from '@mui/material';
import { Link } from 'react-router-dom';
import { colors } from '../theme/colors';

export default function File({
  to,
  name,
  description,
  actions,
  icon,
}: {
  to: string;
  name: string;
  description: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
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
          <Typography variant="body1" color="text.primary">
            {name}
          </Typography>
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
