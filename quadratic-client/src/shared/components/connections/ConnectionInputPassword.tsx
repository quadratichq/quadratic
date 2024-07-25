import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { forwardRef, useState } from 'react';

type InputProps = React.ComponentProps<typeof Input>;

export const ConnectionInputPassword = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const [hidePassword, setHidePassword] = useState(props.value !== '');

  // Override the display of the input if the password is being hidden
  const overrides = hidePassword
    ? {
        value: '',
        placeholder:
          typeof props.value === 'string'
            ? props.value
                .split('')
                .map(() => '•')
                .join('')
            : '',
        disabled: true,
      }
    : {};

  return (
    <div className="relative">
      <Input
        autoComplete="off" // Tells browser to not save password (often ignored)
        type={'text'}
        className="pr-14"
        ref={ref}
        {...props}
        {...overrides}
      />
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-0.5 top-0.5 text-muted-foreground hover:bg-transparent"
        type="button"
        onClick={() => setHidePassword((prev) => !prev)}
      >
        {hidePassword ? 'Show' : 'Hide'}
      </Button>
    </div>
  );
});
