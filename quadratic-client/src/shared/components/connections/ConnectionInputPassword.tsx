import { Input } from '@/shared/shadcn/ui/input';

// extend typeof Input to include hidePassword prop
type InputProps = React.ComponentProps<typeof Input>;
interface ConnectionInputPasswordProps extends InputProps {
  hidePassword?: boolean;
}

export const ConnectionInputPassword: React.FC<ConnectionInputPasswordProps> = (props) => {
  const { hidePassword } = props;

  // Override the display of the input if the password is being hidden
  const propsOverrides = hidePassword
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
    <Input
      autoComplete="off" // Tells browser to not save password (often ignored)
      type={'text'}
      {...props}
      {...propsOverrides}
    />
  );
};
