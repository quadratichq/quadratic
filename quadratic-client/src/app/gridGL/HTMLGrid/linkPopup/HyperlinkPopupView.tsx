import { Favicon } from '@/shared/components/Favicon';
import { Button } from '@/shared/shadcn/ui/button';
import { CopyIcon, ExternalLinkIcon, Pencil1Icon, TrashIcon } from '@radix-ui/react-icons';
import { getDomainFromUrl } from './useLinkMetadata';

interface HyperlinkPopupViewProps {
  url: string;
  linkTitle: string | undefined;
  isFormula: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

export const HyperlinkPopupView = ({
  url,
  linkTitle,
  isFormula,
  onOpen,
  onCopy,
  onEdit,
  onRemove,
}: HyperlinkPopupViewProps) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {url && <Favicon domain={url} size={16} alt="" className="h-4 w-4 shrink-0" />}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{linkTitle || getDomainFromUrl(url)}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-full truncate text-xs text-muted-foreground hover:text-primary hover:underline"
            onClick={(e) => {
              e.preventDefault();
              onOpen();
            }}
          >
            {url}
          </a>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onOpen} className="h-7 px-2">
          <ExternalLinkIcon className="mr-1 h-3.5 w-3.5" />
          Open
        </Button>
        <Button variant="ghost" size="sm" onClick={onCopy} className="h-7 px-2">
          <CopyIcon className="mr-1 h-3.5 w-3.5" />
          Copy
        </Button>
        <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 px-2">
          <Pencil1Icon className="mr-1 h-3.5 w-3.5" />
          Edit
        </Button>
        {!isFormula && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-7 px-2 text-destructive hover:text-destructive"
          >
            <TrashIcon className="mr-1 h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
};
