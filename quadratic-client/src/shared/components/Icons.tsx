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
export type IconComponent = React.FC<IconProps>;

export const AIIcon: IconComponent = (props) => {
  return <Icon {...props}>auto_awesome</Icon>;
};

export const ArrowDropDownIcon: IconComponent = (props) => {
  return <Icon {...props}>arrow_drop_down</Icon>;
};

export const ArrowDropDownCircleIcon: IconComponent = (props) => {
  return <Icon {...props}>arrow_drop_down_circle</Icon>;
};

export const BorderAllIcon: IconComponent = (props) => {
  return <Icon {...props}>border_all</Icon>;
};

export const BorderOuterIcon: IconComponent = (props) => {
  return <Icon {...props}>border_outer</Icon>;
};

export const BorderInnerIcon: IconComponent = (props) => {
  return <Icon {...props}>border_inner</Icon>;
};

export const BorderVerticalIcon: IconComponent = (props) => {
  return <Icon {...props}>border_vertical</Icon>;
};

export const BorderHorizontalIcon: IconComponent = (props) => {
  return <Icon {...props}>border_horizontal</Icon>;
};

export const BorderLeftIcon: IconComponent = (props) => {
  return <Icon {...props}>border_left</Icon>;
};

export const BorderRightIcon: IconComponent = (props) => {
  return <Icon {...props}>border_right</Icon>;
};

export const BorderTopIcon: IconComponent = (props) => {
  return <Icon {...props}>border_bottom</Icon>;
};

export const BorderBottomIcon: IconComponent = (props) => {
  return <Icon {...props}>border_bottom</Icon>;
};

export const BorderClearIcon: IconComponent = (props) => {
  return <Icon {...props}>border_clear</Icon>;
};

export const CheckBoxIcon: IconComponent = (props) => {
  return <Icon {...props}>check_box</Icon>;
};

export const CheckSmallIcon: IconComponent = (props) => {
  return <Icon {...props}>check_small</Icon>;
};

export const CodeCellOutlineOn: IconComponent = (props) => {
  return <Icon {...props}>select</Icon>;
};

export const CodeCellOutlineOff: IconComponent = (props) => {
  return <Icon {...props}>remove_selection</Icon>;
};

export const CodeIcon: IconComponent = (props) => {
  return <Icon {...props}>code</Icon>;
};

export const CopyIcon: IconComponent = (props) => {
  return <Icon {...props}>content_copy</Icon>;
};

export const CopyAsPng: IconComponent = (props) => {
  return <Icon {...props}>image</Icon>;
};

export const CsvIcon: IconComponent = (props) => {
  return <Icon {...props}>csv</Icon>;
};

export const CurrencyIcon: IconComponent = (props) => {
  return <Icon {...props}>attach_money</Icon>;
};

export const CutIcon: IconComponent = (props) => {
  return <Icon {...props}>content_cut</Icon>;
};

export const CropFreeIcon: IconComponent = (props) => {
  return <Icon {...props}>crop_free</Icon>;
};

export const DatabaseIcon: IconComponent = (props) => {
  return <Icon {...props}>database</Icon>;
};

export const DataObjectIcon: IconComponent = (props) => {
  return <Icon {...props}>data_object</Icon>;
};

export const DocumentationIcon: IconComponent = (props) => {
  return <Icon {...props}>menu_book</Icon>;
};

export const DecimalDecreaseIcon: IconComponent = (props) => {
  return <Icon {...props}>decimal_decrease</Icon>;
};

export const DecimalIncreaseIcon: IconComponent = (props) => {
  return <Icon {...props}>decimal_increase</Icon>;
};

export const DeleteIcon: IconComponent = (props) => {
  return <Icon {...props}>delete</Icon>;
};

export const DownloadIcon: IconComponent = (props) => {
  return <Icon {...props}>download</Icon>;
};

export const DraftIcon: IconComponent = (props) => {
  return <Icon {...props}>draft</Icon>;
};

export const EditIcon: IconComponent = (props) => {
  return <Icon {...props}>edit</Icon>;
};

export const FormatAlignCenterIcon: IconComponent = (props) => {
  return <Icon {...props}>format_align_center</Icon>;
};

export const FormatAlignLeftIcon: IconComponent = (props) => {
  return <Icon {...props}>format_align_left</Icon>;
};

export const FormatAlignRightIcon: IconComponent = (props) => {
  return <Icon {...props}>format_align_right</Icon>;
};

export const FormatClearIcon: IconComponent = (props) => {
  return <Icon {...props}>format_clear</Icon>;
};

export const FormatColorFillIcon: IconComponent = (props) => {
  return <Icon {...props}>format_color_fill</Icon>;
};

export const FormatColorTextIcon: IconComponent = (props) => {
  return <Icon {...props}>format_color_text</Icon>;
};

export const FormatBoldIcon: IconComponent = (props) => {
  return <Icon {...props}>format_bold</Icon>;
};

export const FormatItalicIcon: IconComponent = (props) => {
  return <Icon {...props}>format_italic</Icon>;
};

export const FormatNumberAutomaticIcon: IconComponent = (props) => {
  return <Icon {...props}>award_star</Icon>;
};

export const FormatTextClipIcon: IconComponent = (props) => {
  return <Icon {...props}>format_text_clip</Icon>;
};

export const FormatTextOverflowIcon: IconComponent = (props) => {
  return <Icon {...props}>format_text_overflow</Icon>;
};

export const FormatTextWrapIcon: IconComponent = (props) => {
  return <Icon {...props}>format_text_wrap</Icon>;
};

export const FormatToggleCommasIcon: IconComponent = (props) => {
  return <Icon {...props}>format_quote</Icon>;
};

export const FileCopyIcon: IconComponent = (props) => {
  return <Icon {...props}>file_copy</Icon>;
};

export const FileRenameIcon: IconComponent = (props) => {
  return <Icon {...props}>text_select_start</Icon>;
};

export const FunctionIcon: IconComponent = (props) => {
  return <Icon {...props}>function</Icon>;
};

export const FeedbackIcon: IconComponent = (props) => {
  return <Icon {...props}>feedback</Icon>;
};

export const GoToIcon: IconComponent = (props) => {
  return <Icon {...props}>arrow_top_right</Icon>;
};

export const ImportIcon: IconComponent = (props) => {
  return <Icon {...props}>login</Icon>;
};

export const InsertChartIcon: IconComponent = (props) => {
  return <Icon {...props}>insert_chart</Icon>;
};

export const HelpIcon: IconComponent = (props) => {
  return <Icon {...props}>help</Icon>;
};

export const MailIcon: IconComponent = (props) => {
  return <Icon {...props}>mail</Icon>;
};

export const ManageSearch: IconComponent = (props) => {
  return <Icon {...props}>manage_search</Icon>;
};

export const MemoryIcon: IconComponent = (props) => {
  return <Icon {...props}>memory</Icon>;
};

export const Number123Icon: IconComponent = (props) => {
  // TODO: (jimniels) merge classNames here
  // TODO: (jimniels) if we support sizing, you'll have to adjust this for each size
  // This icon is just too small, so we make it more readable within its container
  // by increasing its size and adjusting its position
  return (
    <Icon {...props} className="relative left-[-4px] top-[-4px] !text-[28px]">
      123
    </Icon>
  );
};

export const FindInFileIcon: IconComponent = (props) => {
  return <Icon {...props}>pageview</Icon>;
};

export const PasteIcon: IconComponent = (props) => {
  return <Icon {...props}>content_paste</Icon>;
};

export const PercentIcon: IconComponent = (props) => {
  return <Icon {...props}>percent</Icon>;
};

export const PersonAddIcon: IconComponent = (props) => {
  return <Icon {...props}>person_add</Icon>;
};

export const RedoIcon: IconComponent = (props) => {
  return <Icon {...props}>redo</Icon>;
};

export const ScientificIcon: IconComponent = (props) => {
  return <Icon {...props}>functions</Icon>;
};

export const SheetIcon: IconComponent = (props) => {
  return <Icon {...props}>tab</Icon>;
};

export const VerticalAlignBottomIcon: IconComponent = (props) => {
  return <Icon {...props}>vertical_align_bottom</Icon>;
};

export const VerticalAlignMiddleIcon: IconComponent = (props) => {
  return <Icon {...props}>vertical_align_center</Icon>;
};

export const VerticalAlignTopIcon: IconComponent = (props) => {
  return <Icon {...props}>vertical_align_top</Icon>;
};

export const UndoIcon: IconComponent = (props) => {
  return <Icon {...props}>undo</Icon>;
};

export const ZoomInIcon: IconComponent = (props) => {
  return <Icon {...props}>zoom_in</Icon>;
};

export const ZoomOutIcon: IconComponent = (props) => {
  return <Icon {...props}>zoom_out</Icon>;
};
