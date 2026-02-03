import { MENUBAR_FOCUS_GRID_DELAY_MS } from '@/shared/constants/appConstants';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { useEffect, useRef } from 'react';

// Buffer time added to MENUBAR_FOCUS_GRID_DELAY_MS to ensure this component's
// focus happens after the menubar's focusGrid call completes
const FOCUS_BUFFER_MS = 50;

interface HyperlinkPopupEditProps {
  editText: string;
  editUrl: string;
  hideTextField?: boolean;
  onTextChange: (text: string) => void;
  onUrlChange: (url: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onKeyUp?: (e: React.KeyboardEvent) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const HyperlinkPopupEdit = ({
  editText,
  editUrl,
  hideTextField,
  onTextChange,
  onUrlChange,
  onKeyDown,
  onKeyUp,
  onSave,
  onCancel,
}: HyperlinkPopupEditProps) => {
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the URL input when the component mounts.
    // Delay must exceed MENUBAR_FOCUS_GRID_DELAY_MS to ensure focus happens
    // after the menubar's focusGrid call (which fires when menu closes).
    const timeoutId = setTimeout(() => {
      urlInputRef.current?.focus();
    }, MENUBAR_FOCUS_GRID_DELAY_MS + FOCUS_BUFFER_MS);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="link-url">URL</Label>
        <Input
          ref={urlInputRef}
          id="link-url"
          value={editUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          placeholder="https://example.com"
          className="h-8"
        />
      </div>
      {!hideTextField && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="link-text">Text</Label>
          <Input
            id="link-text"
            value={editText}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            placeholder="Link text (optional)"
            className="h-8"
          />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="h-7">
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={!editUrl.trim()} className="h-7">
          Save
        </Button>
      </div>
    </div>
  );
};
