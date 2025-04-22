import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { useState } from 'react';

export const ConnectionFormSshKey = ({ value }: { value: string }) => {
  // decode the ssh key from base64 to a string
  const sshKey = atob(value);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sshKey).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  };

  return (
    <div className="relative">
      <Input
        autoComplete="off" // Tells browser to not save password (often ignored)
        type={'password'}
        className="pr-8"
        disabled
        value={'xxxxxxxxxxxxx'}
      />
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-0.5 top-0.5 text-muted-foreground hover:bg-transparent"
        type="button"
        onClick={handleCopy}
      >
        {copied ? 'Copied!' : 'Copy'}
      </Button>
    </div>
  );
};
