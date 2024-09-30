import {
  DOCUMENTATION_CONNECTIONS_IP_LIST_URL,
  DOCUMENTATION_CONNECTIONS_URL,
  TRUST_CENTER,
} from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { CopyIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { useState } from 'react';

export const ConnectionsSidebar = ({ staticIps }: { staticIps: string[] | null }) => {
  const staticIpsContent = staticIps ? staticIps.join('\n') : '';

  return (
    <div className="flex flex-col gap-6 text-sm">
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
      {staticIpsContent && (
        <SidebarItem
          title="IP allow-list"
          description="Data behind a firewall may require you explicitly allow our IP addresses."
          linkText="Learn more"
          linkHref={DOCUMENTATION_CONNECTIONS_IP_LIST_URL}
        >
          <pre className="relative mt-2 bg-accent px-3 py-2">
            <SidebarCopyButton contentToCopy={staticIpsContent} />
            {staticIpsContent}
          </pre>
        </SidebarItem>
      )}
    </div>
  );
};

function SidebarItem({ title, description, linkText, linkHref, children }: any) {
  return (
    <div>
      <div>
        <h3 className="inline font-medium">{title}:</h3> <p className="inline text-muted-foreground">{description}</p>
        {linkText && linkHref && (
          <p className="inline hover:text-primary">
            {' '}
            <a href={linkHref} target="_blank" rel="noreferrer" className="underline ">
              {linkText}
            </a>{' '}
            <ExternalLinkIcon className="inline" />
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function SidebarCopyButton({ contentToCopy }: { contentToCopy: string }) {
  const [copyTriggered, setCopyTriggered] = useState(false);

  return (
    <Tooltip>
      <TooltipTrigger
        onClick={(event) => {
          event.preventDefault();
        }}
        asChild
      >
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute right-1 top-1 text-muted-foreground hover:text-foreground"
          onClick={() => {
            navigator.clipboard.writeText(contentToCopy);
            setCopyTriggered(true);
            setTimeout(() => setCopyTriggered(false), 1000);
          }}
        >
          <CopyIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
      >
        {copyTriggered ? 'Copied!' : 'Copy'}
      </TooltipContent>
    </Tooltip>
  );
}
