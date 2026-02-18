import { useConnectionsContext } from '@/shared/components/connections/ConnectionsContext';
import { ArrowRightIcon } from '@/shared/components/Icons';
import { DOCUMENTATION_CONNECTIONS_IP_LIST_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { FormDescription } from '@/shared/shadcn/ui/form';
import { Label } from '@/shared/shadcn/ui/label';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useRef, useState } from 'react';

export function ConnectionFormIpAllowList() {
  const { staticIps } = useConnectionsContext();
  const value = staticIps.join('\n');
  const [open, setOpen] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      textareaRef.current?.select();
    }
  }, [open, value]);

  if (!value) return null;

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center gap-2">
        <ArrowRightIcon className={cn(open ? 'rotate-90' : '')} />
        <Label htmlFor="ip-allow-list" onClick={() => setOpen(!open)}>
          IP address allow-list
        </Label>
      </div>
      {open && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Textarea
              id="ip-allow-list"
              ref={textareaRef}
              className="h-19 font-mono"
              readOnly
              rows={staticIps.length}
              value={value}
              onFocus={(event) => {
                event.preventDefault();
                textareaRef.current?.select();
              }}
            />
            <Button
              className="w-24"
              type="button"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(value);

                setShowCopied(true);
                setTimeout(() => setShowCopied(false), 1000);
              }}
            >
              {showCopied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <FormDescription>
            When necessary, add both these IPs to your network allow-list.{' '}
            <a
              href={DOCUMENTATION_CONNECTIONS_IP_LIST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              Learn more.
            </a>
          </FormDescription>
        </div>
      )}
    </div>
  );
}
