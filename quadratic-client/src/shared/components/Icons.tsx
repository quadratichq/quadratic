/**
 * TODO: (jimniels) explain how this implementation works
 * Styles are in ./icons.css
 * Font is imported in index.html
 * We import 20 and 24 dp icons
 *
 */
import './icons.css';

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

export const ArrowTopRightIcon = (props: IconProps) => {
  return <Icon {...props}>arrow_top_right</Icon>;
};

export const ArrowDropDownIcon = (props: IconProps) => {
  return <Icon {...props}>arrow_drop_down</Icon>;
};

export const CheckSmallIcon = (props: IconProps) => {
  return <Icon {...props}>check_small</Icon>;
};

export const CodeCellOutlineOn = (props: IconProps) => {
  return <Icon {...props}>select</Icon>;
};

export const CodeCellOutlineOff = (props: IconProps) => {
  return <Icon {...props}>remove_selection</Icon>;
};

export const CodeIcon = (props: IconProps) => {
  return <Icon {...props}>code</Icon>;
};

export const CopyIcon = (props: IconProps) => {
  return <Icon {...props}>content_copy</Icon>;
};

export const CutIcon = (props: IconProps) => {
  return <Icon {...props}>content_cut</Icon>;
};

export const CropFreeIcon = (props: IconProps) => {
  return <Icon {...props}>crop_free</Icon>;
};

export const DatabaseIcon = (props: IconProps) => {
  return <Icon {...props}>database</Icon>;
};

export const DownloadIcon = (props: IconProps) => {
  return <Icon {...props}>download</Icon>;
};

export const DraftIcon = (props: IconProps) => {
  return <Icon {...props}>draft</Icon>;
};

export const EditIcon = (props: IconProps) => {
  return <Icon {...props}>edit</Icon>;
};

export const FunctionIcon = (props: IconProps) => {
  return <Icon {...props}>function</Icon>;
};

export const FeedbackIcon = (props: IconProps) => {
  return <Icon {...props}>feedback</Icon>;
};

export const HelpIcon = (props: IconProps) => {
  return <Icon {...props}>help</Icon>;
};

export const ManageSearch = (props: IconProps) => {
  return <Icon {...props}>manage_search</Icon>;
};

export const MenuBookIcon = (props: IconProps) => {
  return <Icon {...props}>menu_book</Icon>;
};

export const PageViewIcon = (props: IconProps) => {
  return <Icon {...props}>pageview</Icon>;
};

export const PasteIcon = (props: IconProps) => {
  return <Icon {...props}>content_paste</Icon>;
};

export const RedoIcon = (props: IconProps) => {
  return <Icon {...props}>redo</Icon>;
};

export const UndoIcon = (props: IconProps) => {
  return <Icon {...props}>undo</Icon>;
};

export const ZoomInIcon = (props: IconProps) => {
  return <Icon {...props}>zoom_in</Icon>;
};
