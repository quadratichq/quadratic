import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { useCallback } from 'react';
import { useRecoilState } from 'recoil';

export const TableSort = () => {
  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);

  const onClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setContextMenu({});
      }
    },
    [setContextMenu]
  );

  const open = contextMenu?.type === ContextMenuType.TableSort;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sort Table</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
