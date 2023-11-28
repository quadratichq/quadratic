import { Close } from '@mui/icons-material';
import {
  Box,
  Button,
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
QDialog.Title = Title;

const Content: React.FC<QDialogContentProps> = ({ children }) => {
  return <DialogContent dividers>{children}</DialogContent>;
};
QDialog.Content = Content;

const Actions: React.FC<QDialogActionsProps> = ({ children }) => {
  const theme = useTheme();
  return (
    <DialogActions sx={{ alignItems: 'center', px: theme.spacing(3), py: theme.spacing(1.5) }}>
      {children}
    </DialogActions>
  );
};
QDialog.Actions = Actions;

/**
 * A reusable dialog component for confirming the deletion of an object in the system.
 * TODO swap out for all `window.confirm` actions
 * @param {Object} props - The component's props.
 * @param {() => void} props.onClose - A function to close the dialog without any other side effects.
 * @param {string} props.entityNoun - A (lowercased) noun representing the entity that will be deleted (e.g., "team" or "file").
 * @param {string} props.entityName - The name of the entity to be deleted (e.g. "Jim’s Amazing Team")
 * @param {React.ReactNode?} props.children - Additional content to display in the body of the dialog (will appear as a child of the `<Typography>` component).
 * @param {() => void} props.onDelete - A function to perform the deletion action.
 */
const QDialogConfirmDelete = ({
  children,
  entityName,
  entityNoun,
  onClose,
  onDelete,
}: {
  children?: React.ReactNode;
  entityNoun: string;
  entityName: string;
  onClose: () => void;
  onDelete: () => void;
}) => {
  return (
    <QDialog onClose={onClose} maxWidth="xs">
      <QDialog.Title>Confirm delete</QDialog.Title>
      <QDialog.Content>
        <Typography variant="body2">
          Please confirm you want to delete the {entityNoun}: <b>“{entityName}”</b>.
        </Typography>
        {children && (
          <>
            <br />
            <Typography variant="body2">{children}</Typography>
          </>
        )}
      </QDialog.Content>
      <QDialog.Actions>
        <Button variant="outlined" autoFocus onClick={onClose} size="small">
          Cancel
        </Button>
        <Button variant="contained" color="error" disableElevation onClick={onDelete} size="small">
          Delete
        </Button>
      </QDialog.Actions>
    </QDialog>
  );
};

export { QDialog, QDialogConfirmDelete };
