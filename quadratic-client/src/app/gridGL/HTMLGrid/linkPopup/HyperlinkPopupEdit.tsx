import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';

interface HyperlinkPopupEditProps {
  editText: string;
  editUrl: string;
  onTextChange: (text: string) => void;
  onUrlChange: (url: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const HyperlinkPopupEdit = ({
  editText,
  editUrl,
  onTextChange,
  onUrlChange,
  onKeyDown,
  onSave,
  onCancel,
}: HyperlinkPopupEditProps) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="link-text">Text</Label>
        <Input
          id="link-text"
          value={editText}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Link text"
          className="h-8"
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="link-url">URL</Label>
        <Input
          id="link-url"
          value={editUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="https://example.com"
          className="h-8"
        />
      </div>
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
