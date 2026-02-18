import { DOCUMENTATION_CONNECTIONS_URL, TRUST_CENTER } from '@/shared/constants/urls';
import { ExternalLinkIcon } from '@radix-ui/react-icons';

export const ConnectionsSidebar = () => {
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
    </div>
  );
};

function SidebarItem({
  title,
  description,
  linkText,
  linkHref,
}: {
  title: string;
  description: string;
  linkText?: string;
  linkHref?: string;
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
    </div>
  );
}
