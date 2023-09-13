import { Close } from '@mui/icons-material';
import { Box, Dialog, DialogActions, DialogContent, IconButton, Paper, Typography, useTheme } from '@mui/material';
import * as React from 'react';

interface DialogProps {
  children: React.ReactNode;
  onClose: () => void;
}

interface DialogTitleProps {
  children: React.ReactNode;
}

interface DialogContentProps {
  children: React.ReactNode;
}

interface DialogActionsProps {
  children: React.ReactNode;
}

const QDialog: React.FC<DialogProps> & {
  Title: React.FC<DialogTitleProps>;
  Content: React.FC<DialogContentProps>;
  Actions: React.FC<DialogActionsProps>;
} = ({ children, onClose }) => {
  const theme = useTheme();

  return (
    <Dialog open={true} onClose={onClose} fullWidth maxWidth={'sm'}>
      <Paper elevation={12}>
        {children}
        <IconButton onClick={onClose} sx={{ position: 'absolute', top: theme.spacing(1), right: theme.spacing(3) }}>
          <Close fontSize="small" />
        </IconButton>
      </Paper>
    </Dialog>
  );
};

const Title: React.FC<DialogTitleProps> = ({ children }) => {
  const theme = useTheme();

  return (
    <Box sx={{ px: theme.spacing(3), py: theme.spacing(1.5) }}>
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: '600',
          display: 'block',
          textOverflow: 'ellipsis',
          textWrap: 'nowrap',
          overflow: 'hidden',
          marginRight: theme.spacing(6),
        }}
      >
        {children}
      </Typography>
    </Box>
  );
};

const Content: React.FC<DialogContentProps> = ({ children }) => {
  return <DialogContent dividers>{children}</DialogContent>;
};

const Actions: React.FC<DialogActionsProps> = ({ children }) => {
  const theme = useTheme();
  return (
    <DialogActions sx={{ alignItems: 'center', px: theme.spacing(3), py: theme.spacing(1.5) }}>
      {children}
    </DialogActions>
  );
};

QDialog.Title = Title;
QDialog.Content = Content;
QDialog.Actions = Actions;

export { QDialog };
