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
import { useNavigate, useRevalidator } from 'react-router';
import { ROUTES } from '@/shared/constants/routes';

interface FolderNode {
  uuid: string;
  name: string;
  parentFolderUuid: string | null;
  ownerUserId: number | null;
  children: FolderNode[];
}

/** Selected destination: team root, personal root, or a folder uuid. */
type SelectedDestination = 'team-root' | 'personal-root' | string;

function buildFolderTree(
  folders: Array<{ uuid: string; name: string; parentFolderUuid: string | null; ownerUserId?: number | null }>,
  filter: 'team' | 'private'
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
      const isPrivate = node.ownerUserId !== null;
      if ((filter === 'private' && isPrivate) || (filter === 'team' && !isPrivate)) {
        roots.push(node);
      }
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
    activeTeam: {
      team: { uuid: teamUuid },
      folders,
      userMakingRequest: { id: userId },
    },
  } = useDashboardRouteLoaderData();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const initialDestination: SelectedDestination = currentFolderUuid != null ? currentFolderUuid : 'team-root';
  const [selected, setSelected] = useState<SelectedDestination>(initialDestination);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamTree = useMemo(() => buildFolderTree(folders, 'team'), [folders]);
  const personalTree = useMemo(() => buildFolderTree(folders, 'private'), [folders]);

  const handleMove = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (selected === 'team-root') {
        await apiClient.files.update(fileUuid, { folderUuid: null, ownerUserId: null });
      } else if (selected === 'personal-root') {
        await apiClient.files.update(fileUuid, { folderUuid: null, ownerUserId: userId });
      } else {
        await apiClient.files.update(fileUuid, { folderUuid: selected });
      }
      revalidator.revalidate();
      onClose();
      if (selected === 'team-root') {
        navigate(ROUTES.TEAM_DRIVE_TEAM(teamUuid));
      } else if (selected === 'personal-root') {
        navigate(ROUTES.TEAM_DRIVE_PRIVATE(teamUuid));
      } else {
        navigate(ROUTES.TEAM_DRIVE_FOLDER(teamUuid, selected));
      }
    } catch {
      setError('Failed to move file. Please try again.');
      setIsLoading(false);
    }
  }, [fileUuid, selected, userId, teamUuid, onClose, navigate, revalidator]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
          <DialogDescription>Select a folder to move this file into.</DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
          <FolderPickerRootRow
            label="Team Files"
            icon={<FolderIcon className="text-muted-foreground" />}
            isSelected={selected === 'team-root'}
            onClick={() => setSelected('team-root')}
          />
          {teamTree.map((node) => (
            <FolderPickerItem key={node.uuid} node={node} depth={0} selected={selected} onSelect={setSelected} />
          ))}
          <FolderPickerRootRow
            label="Personal Files"
            icon={<FolderSpecialIcon className="text-muted-foreground" />}
            isSelected={selected === 'personal-root'}
            onClick={() => setSelected('personal-root')}
            className="mt-3"
          />
          {personalTree.map((node) => (
            <FolderPickerItem key={node.uuid} node={node} depth={0} selected={selected} onSelect={setSelected} />
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

export function MoveToFolderBulkDialog({ fileUuids, onClose }: { fileUuids: string[]; onClose: () => void }) {
  const {
    activeTeam: {
      team: { uuid: teamUuid },
      folders,
      userMakingRequest: { id: userId },
    },
  } = useDashboardRouteLoaderData();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [selected, setSelected] = useState<SelectedDestination>('team-root');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamTree = useMemo(() => buildFolderTree(folders, 'team'), [folders]);
  const personalTree = useMemo(() => buildFolderTree(folders, 'private'), [folders]);

  const handleMove = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const BATCH_SIZE = 5;
      const results: PromiseSettledResult<unknown>[] = [];
      for (let i = 0; i < fileUuids.length; i += BATCH_SIZE) {
        const batch = fileUuids.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map(async (uuid) => {
            if (selected === 'team-root') {
              return apiClient.files.update(uuid, { folderUuid: null, ownerUserId: null });
            } else if (selected === 'personal-root') {
              return apiClient.files.update(uuid, { folderUuid: null, ownerUserId: userId });
            } else {
              return apiClient.files.update(uuid, { folderUuid: selected });
            }
          })
        );
        results.push(...batchResults);
      }
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failures.length > 0) {
        setError(
          failures.length === fileUuids.length
            ? 'Failed to move files. Please try again.'
            : `Failed to move ${failures.length} of ${fileUuids.length} files.`
        );
        setIsLoading(false);
        revalidator.revalidate();
        return;
      }
      revalidator.revalidate();
      onClose();
      if (selected === 'team-root') {
        navigate(ROUTES.TEAM_DRIVE_TEAM(teamUuid));
      } else if (selected === 'personal-root') {
        navigate(ROUTES.TEAM_DRIVE_PRIVATE(teamUuid));
      } else {
        navigate(ROUTES.TEAM_DRIVE_FOLDER(teamUuid, selected));
      }
    } catch {
      setError('Failed to move files. Please try again.');
      setIsLoading(false);
    }
  }, [fileUuids, selected, userId, teamUuid, onClose, navigate, revalidator]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
          <DialogDescription>
            Select a folder to move {fileUuids.length} file{fileUuids.length === 1 ? '' : 's'} into.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
          <FolderPickerRootRow
            label="Team Files"
            icon={<FolderIcon className="text-muted-foreground" />}
            isSelected={selected === 'team-root'}
            onClick={() => setSelected('team-root')}
          />
          {teamTree.map((node) => (
            <FolderPickerItem key={node.uuid} node={node} depth={0} selected={selected} onSelect={setSelected} />
          ))}
          <FolderPickerRootRow
            label="Personal Files"
            icon={<FolderSpecialIcon className="text-muted-foreground" />}
            isSelected={selected === 'personal-root'}
            onClick={() => setSelected('personal-root')}
            className="mt-3"
          />
          {personalTree.map((node) => (
            <FolderPickerItem key={node.uuid} node={node} depth={0} selected={selected} onSelect={setSelected} />
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

function FolderPickerRootRow({
  label,
  icon,
  isSelected,
  onClick,
  className,
}: {
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent',
        isSelected && 'bg-primary/10 font-medium',
        className
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function FolderPickerItem({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: FolderNode;
  depth: number;
  selected: SelectedDestination;
  onSelect: (destination: SelectedDestination) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = selected === node.uuid;

  return (
    <>
      <button
        className={cn(
          'flex w-full items-center gap-1 px-3 py-1.5 text-left text-sm hover:bg-accent',
          isSelected && 'bg-primary/10 font-medium'
        )}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => onSelect(node.uuid)}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center self-center">
          {hasChildren ? (
            <span
              role="button"
              tabIndex={0}
              className="flex size-5 cursor-pointer items-center justify-center rounded hover:bg-accent"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }
              }}
            >
              <ChevronRightIcon
                className={cn('text-muted-foreground transition-transform', isExpanded && 'rotate-90')}
              />
            </span>
          ) : null}
        </span>
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
          <FolderPickerItem key={child.uuid} node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
        ))}
    </>
  );
}
