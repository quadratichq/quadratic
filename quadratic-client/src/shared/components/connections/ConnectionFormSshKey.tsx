import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { forwardRef, useState } from 'react';

type InputProps = React.ComponentProps<typeof Input>;

export const ConnectionFormSshKey = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const [copied, setCopied] = useState(false);

  if (!props.value) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(String(props.value)).then(() => {
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
        ref={ref}
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
});

ConnectionFormSshKey.displayName = 'ConnectionFormSshKey';
