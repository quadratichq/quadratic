import { Button } from '@/shared/shadcn/ui/button';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { cn } from '@/shared/shadcn/utils';
import { EditIcon, CheckIcon, CloseIcon, DeleteIcon } from '@/shared/components/Icons';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

interface PlanStepProps {
  id: string;
  content: string;
  isEditing: boolean;
  stepNumber: number;
  onEdit: (id: string, content: string) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: (id: string) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export const PlanStep = memo(({
  id,
  content,
  isEditing,
  stepNumber,
  onEdit,
  onStartEdit,
  onCancelEdit,
  onDelete,
  className,
}: PlanStepProps) => {
  const [editContent, setEditContent] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditContent(content);
  }, [content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const length = editContent.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing, editContent]);

  const handleSave = useCallback(() => {
    const trimmedContent = editContent.trim();
    if (trimmedContent && trimmedContent !== content) {
      onEdit(id, trimmedContent);
    } else {
      onCancelEdit(id);
    }
  }, [id, editContent, content, onEdit, onCancelEdit]);

  const handleCancel = useCallback(() => {
    setEditContent(content);
    onCancelEdit(id);
  }, [id, content, onCancelEdit]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSave();
    }
  }, [handleCancel, handleSave]);

  const handleStartEdit = useCallback(() => {
    onStartEdit(id);
  }, [id, onStartEdit]);

  const handleDelete = useCallback(() => {
    onDelete(id);
  }, [id, onDelete]);

  if (isEditing) {
    return (
      <div className={cn("group border border-border rounded-lg p-4 bg-background", className)}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-muted-foreground">
            Step {stepNumber}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={!editContent.trim()}
              className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <CheckIcon className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
            >
              <CloseIcon className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <Textarea
          ref={textareaRef}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[100px] resize-y border-border focus:ring-2 focus:ring-primary/20"
          placeholder="Enter step details..."
        />
        <div className="mt-2 text-xs text-muted-foreground">
          ⌘+Enter to save • Esc to cancel
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "group border border-border rounded-lg p-4 bg-background cursor-pointer",
        "hover:border-border/80 hover:bg-muted/20 transition-colors",
        className
      )}
      onClick={handleStartEdit}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-muted-foreground">
          Step {stepNumber}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit();
            }}
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            <EditIcon className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <DeleteIcon className="w-3 h-3" />
          </Button>
        </div>
      </div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {content}
      </div>
      <div className="mt-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        Click to edit
      </div>
    </div>
  );
});