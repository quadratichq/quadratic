import { TYPE } from '@/constants/appConstants';
import { Button } from '@/shadcn/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shadcn/ui/dialog';
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

type QDialogProps = any;
// TODO get rid of this and use the same dialog everywhere
// interface QDialogProps extends React.FC<typeof Dialog> {
//   children: React.ReactNode;
//   onClose: () => void;
//   // className?: string;
// }

interface QDialogTitleProps {
  children: React.ReactNode;
}

interface QDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface QDialogActionsProps {
  children: React.ReactNode;
  className?: string;
}

const QDialog: React.FC<QDialogProps> & {
  Title: React.FC<QDialogTitleProps>;
  Content: React.FC<QDialogContentProps>;
  Actions: React.FC<QDialogActionsProps>;
} = ({ children, onClose, ...rest }) => {
  return (
    <Dialog open={true} onOpenChange={onClose} {...rest}>
      <DialogContent>{children}</DialogContent>
    </Dialog>
  );
};

const Title: React.FC<QDialogTitleProps> = ({ children }) => {
  return (
    <DialogHeader>
      <DialogTitle>{children}</DialogTitle>
    </DialogHeader>
  );
};
QDialog.Title = Title;

const Content: React.FC<QDialogContentProps> = ({ children, className }) => {
  return <div className={className ? className : ''}>{children}</div>;
};
QDialog.Content = Content;

const Actions: React.FC<QDialogActionsProps> = ({ children, ...rest }) => {
  return <DialogFooter {...rest}>{children}</DialogFooter>;
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
    <QDialog onClose={onClose} className={`max-w-xs`}>
      <QDialog.Title>Confirm delete</QDialog.Title>
      <QDialog.Content>
        <p className={`${TYPE.body2}`}>
          Please confirm you want to delete the {entityNoun}: <b>“{entityName}”</b>.
        </p>
        {children && (
          <>
            <br />
            <p className={`${TYPE.body2}`}>{children}</p>
          </>
        )}
      </QDialog.Content>
      <QDialog.Actions>
        <Button variant="outline" autoFocus onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onDelete}>
          Delete
        </Button>
      </QDialog.Actions>
    </QDialog>
  );
};

export { QDialog, QDialogConfirmDelete };
