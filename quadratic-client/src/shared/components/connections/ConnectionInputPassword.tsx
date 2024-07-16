import { Input } from '@/shared/shadcn/ui/input';

// extend typeof Input to include hidePassword prop
type InputProps = React.ComponentProps<typeof Input>;
interface ConnectionInputPasswordProps extends InputProps {
  hidePassword?: boolean;
}

export const ConnectionInputPassword: React.FC<ConnectionInputPasswordProps> = (props) => {
  const { hidePassword } = props;

  return (
    <Input
      autoComplete="off" // Tells browser to not save password (often ignored)
      type={hidePassword ? 'hidden' : 'text'} // Use hidden instead of password to prevent browser from saving password
      {...props}
    />
  );
};
