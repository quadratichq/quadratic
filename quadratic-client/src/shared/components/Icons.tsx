/**
 * This is where we map all the icons we use to the ones from [Google's Material Symbols](https://fonts.google.com/icons)
 * We use Google’s recommended implementation strategy, which is loading the font
 * FWIW: the font is loaded via the root `index.html`
 * We import 20 dp icons, as those are the only ones we use at the moment.
 */
import { cn } from '@/shared/shadcn/utils';
import './icons.css';

// const sizes = {
//   sm: '20',
//   md: '24',
//   lg: '40',
//   xl: '48',
// };

/**
 * Base icon component, used to render icons from the Material Symbols font.
 */
interface BaseIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: string;
  // TODO: if and when we need to use other sizes, we'll have this as a prop
  // Note: we'll have to load the additional sizes via the font loader in `index.html`
  // size?: keyof typeof sizes;
}

const Icon = (props: BaseIconProps) => {
  const { children, className, ...rest } = props;
  const _size = '20'; // size ? sizes[size] : sizes['sm'];

  return (
    <span className={`material-symbols-outlined material-symbols-${_size} ${className ? className : ''}`} {...rest}>
      {children}
    </span>
  );
};

/**
 * Individual icons from Material Symbols font.
 */
type IconProps = Omit<BaseIconProps, 'children'>;
export type IconComponent = React.FC<IconProps>;

export const AccountIcon: IconComponent = (props) => {
  return <Icon {...props}>account_circle</Icon>;
};

export const AddIcon: IconComponent = (props) => {
  return <Icon {...props}>add</Icon>;
};

export const AIIcon: IconComponent = (props) => {
  return <Icon {...props}>auto_awesome</Icon>;
};
export const AppearanceLightModeIcon: IconComponent = (props) => {
  return <Icon {...props}>light_mode</Icon>;
};

export const AppearanceDarkModeIcon: IconComponent = (props) => {
  return <Icon {...props}>dark_mode</Icon>;
};

export const AppearanceSystemModeIcon: IconComponent = (props) => {
  return <Icon {...props}>discover_tune</Icon>;
};

export const ApiIcon: IconComponent = (props) => {
  return <Icon {...props}>api</Icon>;
};

export const ArrowDropDownIcon: IconComponent = (props) => {
  return <Icon {...props}>arrow_drop_down</Icon>;
};

export const ArrowDropDownCircleIcon: IconComponent = (props) => {
  return <Icon {...props}>arrow_drop_down_circle</Icon>;
};

export const ArrowUpwardIcon: IconComponent = (props) => {
  return <Icon {...props}>arrow_upward</Icon>;
};

export const BackspaceIcon: IconComponent = (props) => {
  return <Icon {...props}>backspace</Icon>;
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
  return <Icon {...props}>border_top</Icon>;
};

export const BorderBottomIcon: IconComponent = (props) => {
  return <Icon {...props}>border_bottom</Icon>;
};

export const BorderClearIcon: IconComponent = (props) => {
  return <Icon {...props}>border_clear</Icon>;
};

export const BorderStyleIcon: IconComponent = (props) => {
  return <Icon {...props}>border_style</Icon>;
};

export const BorderColorIcon: IconComponent = (props) => {
  return <Icon {...props}>border_color</Icon>;
};

export const CheckBoxIcon: IconComponent = (props) => {
  return <Icon {...props}>check_box</Icon>;
};

export const CheckIcon: IconComponent = (props) => {
  return <Icon {...props}>check</Icon>;
};

export const CheckSmallIcon: IconComponent = (props) => {
  return <Icon {...props}>check_small</Icon>;
};

export const ChevronLeftIcon: IconComponent = (props) => {
  return <Icon {...props}>chevron_left</Icon>;
};

export const ChevronRightIcon: IconComponent = (props) => {
  return <Icon {...props}>chevron_right</Icon>;
};

export const CloseIcon: IconComponent = (props) => {
  return <Icon {...props}>close</Icon>;
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

export const DataValidationsIcon: IconComponent = (props) => {
  return <Icon {...props}>rubric</Icon>;
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

export const DockToLeftIcon: IconComponent = (props) => {
  return <Icon {...props}>dock_to_left</Icon>;
};

export const DeleteIcon: IconComponent = (props) => {
  return <Icon {...props}>delete</Icon>;
};

export const DiffIcon: IconComponent = (props) => {
  return <Icon {...props}>difference</Icon>;
};

export const DockToBottomIcon: IconComponent = (props) => {
  return <Icon {...props}>dock_to_bottom</Icon>;
};

export const DockToRightIcon: IconComponent = (props) => {
  return <Icon {...props}>dock_to_right</Icon>;
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

export const EducationIcon: IconComponent = (props) => {
  return <Icon {...props}>school</Icon>;
};

export const ExamplesIcon: IconComponent = (props) => {
  return <Icon {...props}>view_carousel</Icon>;
};

export const ExpandIcon: IconComponent = (props) => {
  return <Icon {...props}>unfold_less</Icon>;
};

export const CollapseIcon: IconComponent = (props) => {
  return <Icon {...props}>unfold_more</Icon>;
};

export const ExpandCircleDownIcon: IconComponent = (props) => {
  return <Icon {...props}>expand_circle_down</Icon>;
};

export const ExpandCircleUpIcon: IconComponent = (props) => {
  return <Icon {...props}>expand_circle_up</Icon>;
};

export const ExternalLinkIcon: IconComponent = (props) => {
  return <Icon {...props}>arrow_outward</Icon>;
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

export const FormatUnderlinedIcon: IconComponent = (props) => {
  return <Icon {...props}>format_underlined</Icon>;
};

export const FormatStrikethroughIcon: IconComponent = (props) => {
  return <Icon {...props}>format_strikethrough</Icon>;
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

export const FormatDateTimeIcon: IconComponent = (props) => {
  return <Icon {...props}>calendar_month</Icon>;
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

export const GridActionIcon: IconComponent = (props) => {
  return <Icon {...props}>keyboard_double_arrow_right</Icon>;
};

export const GroupIcon: IconComponent = (props) => {
  return <Icon {...props}>group</Icon>;
};

export const HistoryIcon: IconComponent = (props) => {
  return <Icon {...props}>history</Icon>;
};

export const ImportIcon: IconComponent = (props) => {
  return <Icon {...props}>login</Icon>;
};

export const InsertChartIcon: IconComponent = (props) => {
  return <Icon {...props}>insert_chart</Icon>;
};

export const InsertCellRefIcon: IconComponent = (props) => {
  return <Icon {...props}>ink_selection</Icon>;
};

export const LogoutIcon: IconComponent = (props) => {
  return <Icon {...props}>logout</Icon>;
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

export const MenuIcon: IconComponent = (props) => {
  return <Icon {...props}>menu</Icon>;
};

export const MemoryIcon: IconComponent = (props) => {
  return <Icon {...props}>memory</Icon>;
};

export const MoreVertIcon: IconComponent = (props) => {
  return <Icon {...props}>more_vert</Icon>;
};

export const MoreHorizIcon: IconComponent = (props) => {
  return <Icon {...props}>more_horiz</Icon>;
};

export const Number123Icon: IconComponent = (props) => {
  // This icon is just too small, so we make it more readable within its container
  // by increasing its size and adjusting its position
  // TODO: if/when we support sizing, we'll have to adjust this for each size
  return (
    <Icon {...props} className={cn(props.className, 'relative left-[-4px] top-[-4px] !text-[28px]')}>
      123
    </Icon>
  );
};

export const FindInFileIcon: IconComponent = (props) => {
  return <Icon {...props}>pageview</Icon>;
};

export const FilePrivateIcon: IconComponent = (props) => {
  return <Icon {...props}>lock</Icon>;
};

export const FileSharedWithMeIcon: IconComponent = (props) => {
  return <Icon {...props}>move_to_inbox</Icon>;
};

export const LabsIcon: IconComponent = (props) => {
  return <Icon {...props}>experiment</Icon>;
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

export const RefreshIcon: IconComponent = (props) => {
  return <Icon {...props}>refresh</Icon>;
};

export const SaveAndRunIcon: IconComponent = (props) => {
  return <Icon {...props}>play_arrow</Icon>;
};

export const SaveAndRunStopIcon: IconComponent = (props) => {
  return <Icon {...props}>stop</Icon>;
};

export const ScientificIcon: IconComponent = (props) => {
  return <Icon {...props}>functions</Icon>;
};

export const SettingsIcon: IconComponent = (props) => {
  return <Icon {...props}>settings</Icon>;
};

export const SheetIcon: IconComponent = (props) => {
  return <Icon {...props}>tab</Icon>;
};

export const SnippetsIcon: IconComponent = (props) => {
  return <Icon {...props}>integration_instructions</Icon>;
};

export const SpillErrorMoveIcon: IconComponent = (props) => {
  return <Icon {...props}>vertical_align_bottom</Icon>;
};

export const SpinnerIcon: IconComponent = (props) => {
  return (
    <Icon {...props} className={cn(props.className, 'animate-spin')}>
      progress_activity
    </Icon>
  );
};

export const StopIcon: IconComponent = (props) => {
  return <Icon {...props}>stop</Icon>;
};

export const StopCircleIcon: IconComponent = (props) => {
  return <Icon {...props}>stop_circle</Icon>;
};

export const TableIcon: IconComponent = (props) => {
  return <Icon {...props}>table</Icon>;
};

export const ThemeIcon: IconComponent = (props) => {
  return <Icon {...props}>contrast</Icon>;
};

export const ThumbUpIcon: IconComponent = (props) => {
  return <Icon {...props}>thumb_up_alt</Icon>;
};

export const ThumbDownIcon: IconComponent = (props) => {
  return <Icon {...props}>thumb_down_alt</Icon>;
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

export const ViewListIcon: IconComponent = (props) => {
  return <Icon {...props}>list</Icon>;
};

export const ViewGridIcon: IconComponent = (props) => {
  return <Icon {...props}>grid_view</Icon>;
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

export const ArrowRight: IconComponent = (props) => {
  return <Icon {...props}>keyboard_arrow_right</Icon>;
};

export const ArrowDoubleRight: IconComponent = (props) => {
  return <Icon {...props}>keyboard_double_arrow_right</Icon>;
};

export const ArrowDown: IconComponent = (props) => {
  return <Icon {...props}>keyboard_arrow_down</Icon>;
};

export const ArrowDoubleDown: IconComponent = (props) => {
  return <Icon {...props}>keyboard_double_arrow_down</Icon>;
};
