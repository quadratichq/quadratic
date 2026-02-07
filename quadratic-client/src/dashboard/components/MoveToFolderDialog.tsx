import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { apiClient } from '@/shared/api/apiClient';
import { ChevronRightIcon, FolderIcon, FolderSpecialIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/shadcn/ui/dialog';
import { cn } from '@/shared/shadcn/utils';
import { useCallback, useMemo, useState } from 'react';
import { useRevalidator } from 'react-router';

interface FolderNode {
  uuid: string;
  name: string;
  parentFolderUuid: string | null;
  ownerUserId: number | null;
  children: FolderNode[];
}

function buildTree(
  folders: Array<{ uuid: string; name: string; parentFolderUuid: string | null; ownerUserId?: number | null }>
): FolderNode[] {
  const map = new Map<string, FolderNode>();
  for (const f of folders) {
    map.set(f.uuid, { ...f, ownerUserId: f.ownerUserId ?? null, children: [] });
  }
  const roots: FolderNode[] = [];
  for (const node of map.values()) {
    if (node.parentFolderUuid && map.has(node.parentFolderUuid)) {
      map.get(node.parentFolderUuid)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function MoveToFolderDialog({
  fileUuid,
  currentFolderUuid,
  onClose,
}: {
  fileUuid: string;
  currentFolderUuid?: string | null;
  onClose: () => void;
}) {
  const {
    activeTeam: { folders },
  } = useDashboardRouteLoaderData();
  const revalidator = useRevalidator();
  const [selectedFolderUuid, setSelectedFolderUuid] = useState<string | null>(currentFolderUuid ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(folders), [folders]);

  const handleMove = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.files.update(fileUuid, { folderUuid: selectedFolderUuid });
      revalidator.revalidate();
      onClose();
    } catch {
      setError('Failed to move file. Please try again.');
      setIsLoading(false);
    }
  }, [fileUuid, selectedFolderUuid, onClose, revalidator]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
          <DialogDescription>Select a folder to move this file into.</DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
          <button
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
              selectedFolderUuid === null && 'bg-primary/10 font-medium'
            )}
            onClick={() => setSelectedFolderUuid(null)}
          >
            <FolderIcon className="text-muted-foreground" />
            Root (no folder)
          </button>

          {tree.map((node) => (
            <FolderPickerItem
              key={node.uuid}
              node={node}
              depth={0}
              selectedUuid={selectedFolderUuid}
              onSelect={setSelectedFolderUuid}
            />
          ))}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={isLoading} loading={isLoading}>
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FolderPickerItem({
  node,
  depth,
  selectedUuid,
  onSelect,
}: {
  node: FolderNode;
  depth: number;
  selectedUuid: string | null;
  onSelect: (uuid: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedUuid === node.uuid;

  return (
    <>
      <button
        className={cn(
          'flex w-full items-center gap-1 px-3 py-2 text-left text-sm hover:bg-accent',
          isSelected && 'bg-primary/10 font-medium'
        )}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => onSelect(node.uuid)}
      >
        {hasChildren && (
          <button
            className="shrink-0 rounded p-0.5 hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <ChevronRightIcon className={cn('text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
          </button>
        )}
        {!hasChildren && <span className="w-5" />}
        {node.ownerUserId !== null ? (
          <FolderSpecialIcon className="shrink-0 text-muted-foreground" />
        ) : (
          <FolderIcon className="shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isExpanded &&
        hasChildren &&
        node.children.map((child) => (
          <FolderPickerItem
            key={child.uuid}
            node={child}
            depth={depth + 1}
            selectedUuid={selectedUuid}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}
