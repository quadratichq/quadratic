import 'icons.css';

/**
 * Base icon component, used to render icons from the Material Symbols font.
 */
interface BaseIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: string;
  // TODO: size: 'sm' | 'md' | 'lg' | 'xl' -> '20' '24' '40' '48';
}

const Icon = (props: BaseIconProps) => {
  const { children, className, ...rest } = props;
  return (
    <span className={`material-symbols-outlined material-symbols-20 ${className ? className : ''}`} {...rest}>
      {children}
    </span>
  );
};

/**
 * Individual icons from Material Symbols font.
 */
type IconProps = Omit<BaseIconProps, 'children'>;

export const DraftIcon = (props: IconProps) => {
  return <Icon {...props}>draft</Icon>;
};

export const DatabaseIcon = (props: IconProps) => {
  return <Icon {...props}>database</Icon>;
};

export const CodeIcon = (props: IconProps) => {
  return <Icon {...props}>code</Icon>;
};
