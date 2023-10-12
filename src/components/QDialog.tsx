import { Close } from '@mui/icons-material';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogProps,
  IconButton,
  Paper,
  Typography,
  useTheme,
} from '@mui/material';
import * as React from 'react';

/**
 * This is a component for use everywhere in the app where you need a dialog
 * with content. It helps give us a consistent UI/X for dialogs, rather than
 * each place using it's own implementation of MUI's <Dialog>.
 *
 * Usage:
 *
 * <QDialog {...props}>
 *   <QDialog.Title>Title here</Dialog.Title>
 *   <QDialog.Content>
 *     <div>Your content here</div>
 *   </Dialog.Content>
 *   <QDialog.Actions>
 *     <Button>Save</Button>
 *     <Button>Cancel</Button>
 *   </Dialog.Actions>
 * </QDialog>
 */

interface QDialogProps extends Omit<DialogProps, 'open'> {
  children: React.ReactNode;
  onClose: () => void;
}

interface QDialogTitleProps {
  children: React.ReactNode;
}

interface QDialogContentProps {
  children: React.ReactNode;
}

interface QDialogActionsProps {
  children: React.ReactNode;
}

const QDialog: React.FC<QDialogProps> & {
  Title: React.FC<QDialogTitleProps>;
  Content: React.FC<QDialogContentProps>;
  Actions: React.FC<QDialogActionsProps>;
} = ({ children, onClose, ...rest }) => {
  const theme = useTheme();

  return (
    <Dialog onClose={onClose} fullWidth maxWidth={'sm'} {...rest} open={true}>
      <Paper elevation={12}>
        {children}
        <IconButton onClick={onClose} sx={{ position: 'absolute', top: theme.spacing(1), right: theme.spacing(3) }}>
          <Close fontSize="small" />
        </IconButton>
      </Paper>
    </Dialog>
  );
};

const Title: React.FC<QDialogTitleProps> = ({ children }) => {
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

const Content: React.FC<QDialogContentProps> = ({ children }) => {
  return <DialogContent dividers>{children}</DialogContent>;
};

const Actions: React.FC<QDialogActionsProps> = ({ children }) => {
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
