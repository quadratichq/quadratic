import {
  DOCUMENTATION_CONNECTIONS_IP_LIST_URL,
  DOCUMENTATION_CONNECTIONS_URL,
  TRUST_CENTER,
} from '@/shared/constants/urls';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { isSyncedConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useRef, useState } from 'react';

export const ConnectionsSidebar = ({
  staticIps,
  connectionType,
  showIps,
}: {
  staticIps: string[] | null;
  connectionType?: ConnectionType;
  /** Whether to show the IP allow-list section (only shown on database/details pages) */
  showIps?: boolean;
}) => {
  const staticIpsContent = staticIps ? staticIps.join('\n') : '';
  const isSynced = connectionType ? isSyncedConnectionType(connectionType) : false;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <SidebarItem
        title="About connections"
        description="A connection lets you and your team pull outside data into your sheets."
        linkText="Docs"
        linkHref={DOCUMENTATION_CONNECTIONS_URL}
      />
      <SidebarItem
        title="Security & privacy"
        description="Your data and credentials are encrypted and stored securely."
        linkText="Trust center"
        linkHref={TRUST_CENTER}
      />
      {showIps && staticIpsContent && !isSynced && (
        <SidebarItem
          title="IP allow-list"
          description="Add both of our IPs to your network allow-list."
          linkText="Learn more"
          linkHref={DOCUMENTATION_CONNECTIONS_IP_LIST_URL}
        >
          <SidebarCopyContent text={staticIpsContent} />
        </SidebarItem>
      )}
    </div>
  );
};

function SidebarCopyContent({ text }: { text: string }) {
  const [showCopied, setShowCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <Tooltip open={showCopied}>
      <TooltipTrigger
        onClick={(event) => {
          event.preventDefault();
          navigator.clipboard.writeText(text);
          textareaRef.current?.select();
          setShowCopied(true);
          setTimeout(() => setShowCopied(false), 1000);
        }}
        asChild
      >
        <textarea
          ref={textareaRef}
          className="w-full resize-none bg-accent px-3 py-2 font-mono"
          readOnly
          rows={text.split('\n').length}
          value={text}
        ></textarea>
      </TooltipTrigger>
      <TooltipContent>Copied</TooltipContent>
    </Tooltip>
  );
}

function SidebarItem({
  title,
  description,
  linkText,
  linkHref,
  children,
}: {
  title: string;
  description: string;
  linkText?: string;
  linkHref?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div>
        <h3 className="inline font-medium">{title}:</h3> <p className="inline text-muted-foreground">{description}</p>
        {linkText && linkHref && (
          <p className="inline hover:text-primary">
            {' '}
            <a href={linkHref} target="_blank" rel="noreferrer" className="underline">
              {linkText}
            </a>{' '}
            <ExternalLinkIcon className="inline" />
          </p>
        )}
      </div>
      <div className="relative mt-2">{children}</div>
    </div>
  );
}
