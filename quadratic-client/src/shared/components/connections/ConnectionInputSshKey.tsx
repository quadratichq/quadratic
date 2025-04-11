import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Icon } from '@mui/material';
import { CopyIcon } from '@radix-ui/react-icons';
import { forwardRef } from 'react';

type InputProps = React.ComponentProps<typeof Input>;

export const ConnectionInputSshKey = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return (
    <div className="relative">
      <Input
        autoComplete="off" // Tells browser to not save password (often ignored)
        type={'password'}
        className="pr-8"
        ref={ref}
        {...props}
      />
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-0.5 top-2 text-muted-foreground hover:bg-transparent"
        type="button"
        onClick={() => navigator.clipboard.writeText(props.value as string)}
      >
        <Icon>
          <CopyIcon className="h-4 w-4" />
        </Icon>
      </Button>
    </div>
  );
});
