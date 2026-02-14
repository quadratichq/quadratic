import type { AiMemory } from '@/app/ai/memory/aiMemoryService';
import { updateTeamMemory } from '@/app/ai/memory/aiMemoryService';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';

interface AiMemoryNodeDetailProps {
  memory: AiMemory;
  onClose: () => void;
  onDelete: (id: number) => void;
  onTogglePin: (memory: AiMemory) => void;
}

export function AiMemoryNodeDetail({ memory, onClose, onDelete, onTogglePin }: AiMemoryNodeDetailProps) {
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const [isEditing, setIsEditing] = useState(false);
  const [editSummary, setEditSummary] = useState(memory.summary);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!teamUuid || editSummary === memory.summary) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateTeamMemory(teamUuid, memory.id, { summary: editSummary });
      setIsEditing(false);
    } catch (err) {
      console.error('[ai-memory] Failed to update memory:', err);
    } finally {
      setSaving(false);
    }
  }, [teamUuid, memory.id, memory.summary, editSummary]);

  const metadata = memory.metadata as Record<string, unknown>;

  return (
    <div className="flex w-80 shrink-0 flex-col border-l bg-background">
      {/* Detail Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Memory Detail</h3>
        <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Detail Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex flex-col gap-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <p className="text-sm">{memory.title}</p>
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <p className="text-sm">{memory.entityType.replace('_', ' ')}</p>
          </div>

          {/* Summary */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Summary</label>
            {isEditing ? (
              <div className="mt-1 flex flex-col gap-2">
                <textarea
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  className="min-h-[100px] w-full rounded border bg-background p-2 text-sm"
                  disabled={saving}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditSummary(memory.summary);
                    }}
                    className="rounded border px-3 py-1 text-xs hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm leading-relaxed">{memory.summary}</p>
            )}
          </div>

          {/* Metadata */}
          {Object.keys(metadata).length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Metadata</label>
              <div className="mt-1 flex flex-col gap-1">
                {Object.entries(metadata).map(([key, value]) => (
                  <div key={key} className="flex items-baseline gap-2 text-xs">
                    <span className="font-medium text-muted-foreground">{key}:</span>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2 text-xs">
              <span className="font-medium text-muted-foreground">Created:</span>
              <span>{new Date(memory.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex items-baseline gap-2 text-xs">
              <span className="font-medium text-muted-foreground">Updated:</span>
              <span>{new Date(memory.updatedAt).toLocaleString()}</span>
            </div>
            <div className="flex items-baseline gap-2 text-xs">
              <span className="font-medium text-muted-foreground">Version:</span>
              <span>{memory.version}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t p-4">
        <button
          onClick={() => {
            setIsEditing(true);
            setEditSummary(memory.summary);
          }}
          className="flex-1 rounded border px-3 py-1.5 text-xs hover:bg-accent"
        >
          Edit
        </button>
        <button
          onClick={() => onTogglePin(memory)}
          className={`flex-1 rounded border px-3 py-1.5 text-xs hover:bg-accent ${memory.pinned ? 'border-amber-400 text-amber-600' : ''}`}
        >
          {memory.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button
          onClick={() => onDelete(memory.id)}
          className="flex-1 rounded border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
