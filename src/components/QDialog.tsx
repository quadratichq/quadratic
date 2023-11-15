import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shadcn/ui/dialog';
// import { Box, Dialog, DialogActions, DialogContent, IconButton, Paper, Typography, useTheme } from '@mui/material';
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

interface DialogProps {
  children: React.ReactNode;
  onClose: () => void;
}

interface DialogTitleProps {
  children: React.ReactNode;
  description?: string;
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
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>{children}</DialogContent>
    </Dialog>
  );
};

const Title: React.FC<DialogTitleProps> = ({
  children,

  description,
}) => {
  return (
    <DialogHeader>
      <DialogTitle>{children}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
  );
};

const Content: React.FC<DialogContentProps> = ({ children }) => {
  return <div>{children}</div>;
};

const Actions: React.FC<DialogActionsProps> = ({ children }) => {
  return <DialogFooter>{children}</DialogFooter>;
};

QDialog.Title = Title;
QDialog.Content = Content;
QDialog.Actions = Actions;

export { QDialog };
