import type { AiMemory } from '@/app/ai/memory/aiMemoryService';
import {
  deleteTeamMemory,
  listTeamMemories,
  regenerateFileMemories,
  updateTeamMemory,
} from '@/app/ai/memory/aiMemoryService';
import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { AiMemoryNodeDetail } from './AiMemoryNodeDetail';

type ViewMode = 'file' | 'team';

const ENTITY_TYPE_COLORS: Record<string, string> = {
  FILE: 'bg-blue-500',
  CODE_CELL: 'bg-green-500',
  CONNECTION: 'bg-purple-500',
  CHAT_INSIGHT: 'bg-amber-500',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  FILE: 'File',
  CODE_CELL: 'Code Cell',
  CONNECTION: 'Connection',
  CHAT_INSIGHT: 'Chat Insight',
};

const SCOPE_LABELS: Record<string, string> = {
  file: 'File',
  team: 'Team',
};

export function AiMemoryMindMap({ onClose }: { onClose: () => void }) {
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);

  const [viewMode, setViewMode] = useState<ViewMode>('file');
  const [memories, setMemories] = useState<AiMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<AiMemory | null>(null);

  const fetchMemories = useCallback(async () => {
    if (!teamUuid) return;
    setLoading(true);
    try {
      // Fetch file-scoped and team-scoped memories separately to ensure
      // file-scoped memories only come from the current file
      const [fileResult, teamResult] = await Promise.all([
        fileUuid
          ? listTeamMemories(teamUuid, { limit: 100, fileUuid, scope: 'file' })
          : Promise.resolve({ memories: [], nextCursor: null }),
        listTeamMemories(teamUuid, { limit: 100, scope: 'team' }),
      ]);
      setMemories([...fileResult.memories, ...teamResult.memories]);
    } catch (err) {
      console.error('[ai-memory] Failed to fetch memories:', err);
    } finally {
      setLoading(false);
    }
  }, [teamUuid, fileUuid]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleDelete = async (memoryId: number) => {
    if (!teamUuid) return;
    const success = await deleteTeamMemory(teamUuid, memoryId);
    if (success) {
      setMemories((prev) => prev.filter((m) => m.id !== memoryId));
      setSelectedMemory(null);
    }
  };

  const handleTogglePin = async (memory: AiMemory) => {
    if (!teamUuid) return;
    const updated = await updateTeamMemory(teamUuid, memory.id, { pinned: !memory.pinned });
    if (updated) {
      setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setSelectedMemory(updated);
    }
  };

  const handleRegenerate = async () => {
    if (!teamUuid || !fileUuid || regenerating) return;
    setRegenerating(true);
    setSelectedMemory(null);
    try {
      const success = await regenerateFileMemories(teamUuid, fileUuid);
      if (success) {
        // Wait a bit for background generation, then refresh
        setTimeout(() => {
          fetchMemories().finally(() => setRegenerating(false));
        }, 3000);
      } else {
        setRegenerating(false);
      }
    } catch {
      setRegenerating(false);
    }
  };

  // Filter memories based on view mode
  const filteredMemories = useMemo(() => {
    if (viewMode === 'team') {
      return memories.filter((m) => m.scope === 'team');
    }
    // File view: show file-scoped memories + connections (always team-scoped)
    return memories.filter((m) => m.scope === 'file' || m.entityType === 'CONNECTION');
  }, [memories, viewMode]);

  const groups = useMemo(() => {
    // In team view, group by topic; in file view, group by entity type
    if (viewMode === 'team') {
      const byTopic = new Map<string, AiMemory[]>();
      for (const m of filteredMemories) {
        const key = m.topic ?? 'Uncategorized';
        const list = byTopic.get(key) ?? [];
        list.push(m);
        byTopic.set(key, list);
      }
      return [...byTopic.entries()].map(([topic, items]) => ({
        type: topic,
        label: topic,
        items,
      }));
    }

    return [
      { type: 'FILE', label: 'Files', items: filteredMemories.filter((m) => m.entityType === 'FILE') },
      {
        type: 'CODE_CELL',
        label: 'Code Cells',
        items: filteredMemories.filter((m) => m.entityType === 'CODE_CELL'),
      },
      {
        type: 'DATA_TABLE',
        label: 'Data Tables',
        items: filteredMemories.filter((m) => m.entityType === 'DATA_TABLE'),
      },
      {
        type: 'SHEET_TABLE',
        label: 'Sheet Tables',
        items: filteredMemories.filter((m) => m.entityType === 'SHEET_TABLE'),
      },
      {
        type: 'CONNECTION',
        label: 'Connections',
        items: filteredMemories.filter((m) => m.entityType === 'CONNECTION'),
      },
      {
        type: 'CHAT_INSIGHT',
        label: 'Insights',
        items: filteredMemories.filter((m) => m.entityType === 'CHAT_INSIGHT'),
      },
    ].filter((g) => g.items.length > 0);
  }, [filteredMemories, viewMode]);

  const teamCount = memories.filter((m) => m.scope === 'team').length;
  const fileCount = memories.filter((m) => m.scope === 'file').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[80vh] w-[90vw] max-w-5xl flex-col rounded-lg bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">AI Knowledge Map</h2>
            <div className="flex rounded-md border">
              <button
                className={`px-3 py-1 text-sm ${viewMode === 'file' ? 'bg-primary text-primary-foreground' : ''}`}
                onClick={() => setViewMode('file')}
              >
                File ({fileCount})
              </button>
              <button
                className={`px-3 py-1 text-sm ${viewMode === 'team' ? 'bg-primary text-primary-foreground' : ''}`}
                onClick={() => setViewMode('team')}
              >
                Team ({teamCount})
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="rounded border px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              {regenerating ? 'Regenerating...' : 'Regenerate'}
            </button>
            <span className="text-sm text-muted-foreground">{memories.length} memories</span>
            <button onClick={onClose} className="rounded p-1 hover:bg-accent">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Mind Map Area */}
          <div className="flex-1 overflow-auto p-6">
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">Loading memories...</div>
            ) : memories.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <p className="text-lg">No memories yet</p>
                <p className="text-sm">
                  Memories are created automatically when you run code cells and work with your files.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3">
                  {Object.entries(ENTITY_TYPE_LABELS).map(([type, label]) => (
                    <div key={type} className="flex items-center gap-1.5">
                      <div className={`h-3 w-3 rounded-full ${ENTITY_TYPE_COLORS[type]}`} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                  <div className="mx-2 h-4 w-px bg-border" />
                  {Object.entries(SCOPE_LABELS).map(([scope, label]) => (
                    <div key={scope} className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          scope === 'team'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Node Groups */}
                {groups.map((group) => (
                  <div key={group.type}>
                    <h3 className="mb-3 text-sm font-medium text-muted-foreground">{group.label}</h3>
                    <div className="flex flex-wrap gap-3">
                      {group.items.map((memory) => {
                        const isSelected = selectedMemory?.id === memory.id;

                        return (
                          <button
                            key={memory.id}
                            onClick={() => setSelectedMemory(memory)}
                            className={`group relative flex max-w-[280px] flex-col gap-1 rounded-lg border p-3 text-left transition-all hover:shadow-md ${
                              isSelected ? 'border-primary ring-1 ring-primary' : 'border-border'
                            } ${memory.pinned ? 'border-amber-400' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-2 w-2 shrink-0 rounded-full ${ENTITY_TYPE_COLORS[memory.entityType]}`}
                              />
                              <span className="truncate text-sm font-medium">{memory.title}</span>
                              {memory.pinned && <span className="text-xs text-amber-500">pinned</span>}
                            </div>

                            {/* Scope badge and topic */}
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`rounded px-1 py-0.5 text-[10px] font-medium ${
                                  memory.scope === 'team'
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                }`}
                              >
                                {memory.scope}
                              </span>
                              {memory.topic && (
                                <span className="truncate text-[10px] text-muted-foreground">{memory.topic}</span>
                              )}
                            </div>

                            <p className="line-clamp-2 text-xs text-muted-foreground">{memory.summary}</p>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground/60">
                                v{memory.version} · {new Date(memory.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selectedMemory && (
            <AiMemoryNodeDetail
              memory={selectedMemory}
              onClose={() => setSelectedMemory(null)}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
            />
          )}
        </div>
      </div>
    </div>
  );
}
