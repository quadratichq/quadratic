import type { AiMemory } from '@/app/ai/memory/aiMemoryService';
import { deleteTeamMemory, listTeamMemories, updateTeamMemory } from '@/app/ai/memory/aiMemoryService';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useCallback, useEffect, useState } from 'react';
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

export function AiMemoryMindMap({ onClose }: { onClose: () => void }) {
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);

  const [viewMode, setViewMode] = useState<ViewMode>('file');
  const [memories, setMemories] = useState<AiMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMemory, setSelectedMemory] = useState<AiMemory | null>(null);

  const fetchMemories = useCallback(async () => {
    if (!teamUuid) return;
    setLoading(true);
    try {
      const result = await listTeamMemories(teamUuid, {
        limit: 100,
      });
      setMemories(result.memories);
    } catch (err) {
      console.error('[ai-memory] Failed to fetch memories:', err);
    } finally {
      setLoading(false);
    }
  }, [teamUuid]);

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

  // Filter for file view: only show memories that have a file or are connections
  const currentFileMemories =
    viewMode === 'file' ? memories.filter((m) => m.fileId != null || m.entityType === 'CONNECTION') : memories;

  const groups = [
    { type: 'FILE', label: 'Files', items: currentFileMemories.filter((m) => m.entityType === 'FILE') },
    { type: 'CODE_CELL', label: 'Code Cells', items: currentFileMemories.filter((m) => m.entityType === 'CODE_CELL') },
    {
      type: 'CONNECTION',
      label: 'Connections',
      items: currentFileMemories.filter((m) => m.entityType === 'CONNECTION'),
    },
    {
      type: 'CHAT_INSIGHT',
      label: 'Chat Insights',
      items: currentFileMemories.filter((m) => m.entityType === 'CHAT_INSIGHT'),
    },
  ].filter((g) => g.items.length > 0);

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
                File View
              </button>
              <button
                className={`px-3 py-1 text-sm ${viewMode === 'team' ? 'bg-primary text-primary-foreground' : ''}`}
                onClick={() => setViewMode('team')}
              >
                Team View
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
                <div className="flex flex-wrap gap-3">
                  {Object.entries(ENTITY_TYPE_LABELS).map(([type, label]) => (
                    <div key={type} className="flex items-center gap-1.5">
                      <div className={`h-3 w-3 rounded-full ${ENTITY_TYPE_COLORS[type]}`} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Node Groups */}
                {groups.map((group) => (
                  <div key={group.type}>
                    <h3 className="mb-3 text-sm font-medium text-muted-foreground">{group.label}</h3>
                    <div className="flex flex-wrap gap-3">
                      {group.items.map((memory) => (
                        <button
                          key={memory.id}
                          onClick={() => setSelectedMemory(memory)}
                          className={`group relative flex max-w-[280px] flex-col gap-1 rounded-lg border p-3 text-left transition-all hover:shadow-md ${
                            selectedMemory?.id === memory.id ? 'border-primary ring-1 ring-primary' : 'border-border'
                          } ${memory.pinned ? 'border-amber-400' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 shrink-0 rounded-full ${ENTITY_TYPE_COLORS[memory.entityType]}`} />
                            <span className="truncate text-sm font-medium">{memory.title}</span>
                            {memory.pinned && <span className="text-xs text-amber-500">pinned</span>}
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{memory.summary}</p>
                          <span className="text-xs text-muted-foreground/60">
                            v{memory.version} · {new Date(memory.updatedAt).toLocaleDateString()}
                          </span>
                        </button>
                      ))}
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
