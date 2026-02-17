/**
 * This is where we map all the icons we use to the ones from [Google's Material Symbols](https://fonts.google.com/icons)
 * We use Google's recommended implementation strategy, which is loading the font
 * FWIW: the font is loaded via the root `index.html`
 * We import 20 dp icons, as those are the only ones we use at the moment.
 */
import { cn } from '@/shared/shadcn/utils';
import './icons.css';

const sizes = {
  // xxs: '12',
  // xs: '16',
  sm: '20',
  // As needed, we can add these as scaled sizes in icons.css
  // md: '24',
  lg: '40',
  // xl: '48',
  '2xl': '64',
} as const;

/**
 * Base icon component, used to render icons from the Material Symbols font.
 */
interface BaseIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: string;
  // Note: we're not using the fine-tuned optical sizes from material symbols.
  // Instead we're scaling the base 20px size.
  // Maybe in the future we can load the additional fonts and use the optical sizes.
  size?: keyof typeof sizes;
}

const Icon = (props: BaseIconProps) => {
  const { children, className, size = 'sm', ...rest } = props;
  const _size = size ? sizes[size] : sizes['sm'];

  return (
    <span
      className={`material-symbols-outlined material-symbols-${_size} ${className ? className : ''}`}
      {...rest}
      translate="no"
    >
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

export const AddColumnLeftIcon: IconComponent = (props) => {
  return <Icon {...props}>add_column_left</Icon>;
};

export const AddColumnRightIcon: IconComponent = (props) => {
  return <Icon {...props}>add_column_right</Icon>;
};

export const AddRowAboveIcon: IconComponent = (props) => {
  return <Icon {...props}>add_row_above</Icon>;
};

export const AddRowBelowIcon: IconComponent = (props) => {
  return <Icon {...props}>add_row_below</Icon>;
};

export const AddIcon: IconComponent = (props) => {
  return <Icon {...props}>add</Icon>;
};

export const AIIcon: IconComponent = (props) => {
  return <Icon {...props}>auto_awesome</Icon>;
};
export const AgentModeIcon: IconComponent = (props) => {
  return <Icon {...props}>robot_2</Icon>;
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

export const AsteriskIcon: IconComponent = (props) => {
  return <Icon {...props}>asterisk</Icon>;
};

export const AttachFileIcon: IconComponent = (props) => {
  return <Icon {...props}>attach_file</Icon>;
};

export const BackspaceIcon: IconComponent = (props) => {
  return <Icon {...props}>backspace</Icon>;
};

export const BlockIcon: IconComponent = (props) => {
  return <Icon {...props}>block</Icon>;
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

export const CheckBoxEmptyIcon: IconComponent = (props) => {
  return <Icon {...props}>check_box_outline_blank</Icon>;
};

export const CheckBoxIndeterminateIcon: IconComponent = (props) => {
  return <Icon {...props}>indeterminate_check_box</Icon>;
};

export const CheckBoxIcon: IconComponent = (props) => {
  return <Icon {...props}>check_box</Icon>;
};

export const CheckIcon: IconComponent = (props) => {
  return <Icon {...props}>check</Icon>;
};

export const CheckCircleIcon: IconComponent = (props) => {
  return <Icon {...props}>check_circle</Icon>;
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

export const CodeTableIcon: IconComponent = (props) => {
  return <Icon {...props}>code_blocks</Icon>;
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

export const ColorizeIcon: IconComponent = (props) => {
  return <Icon {...props}>colorize</Icon>;
};

export const PaletteIcon: IconComponent = (props) => {
  return <Icon {...props}>palette</Icon>;
};

export const CancelIcon: IconComponent = (props) => {
  return <Icon {...props}>cancel</Icon>;
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

export const DependencyIcon: IconComponent = (props) => {
  return <Icon {...props}>deployed_code</Icon>;
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

export const DownloadExcelIcon: IconComponent = (props) => {
  return <Icon {...props}>file_export</Icon>;
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

export const ExploreSchemaIcon: IconComponent = (props) => {
  return <Icon {...props}>database_search</Icon>;
};

export const CollapseIcon: IconComponent = (props) => {
  return <Icon {...props}>unfold_more</Icon>;
};

export const EnhancePromptIcon: IconComponent = (props) => {
  return <Icon {...props}>wand_stars</Icon>;
};

export const ErrorIcon: IconComponent = (props) => {
  return <Icon {...props}>error</Icon>;
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

export const InsertLinkIcon: IconComponent = (props) => {
  return <Icon {...props}>add_link</Icon>;
};

export const FastForwardIcon: IconComponent = (props) => {
  return <Icon {...props}>fast_forward</Icon>;
};

export const FileIcon: IconComponent = (props) => {
  return <Icon {...props}>draft</Icon>;
};

export const FiltersIcon: IconComponent = (props) => {
  return <Icon {...props}>filter_list</Icon>;
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

export const FormatPaintIcon: IconComponent = (props) => {
  return <Icon {...props}>format_paint</Icon>;
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
  return <Number123Icon {...props} />;
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

export const FormatFontSizeIcon: IconComponent = (props) => {
  return <Icon {...props}>text_fields</Icon>;
};

export const FormatFontSizeIncreaseIcon: IconComponent = (props) => {
  return <Icon {...props}>text_increase</Icon>;
};

export const FormatFontSizeDecreaseIcon: IconComponent = (props) => {
  return <Icon {...props}>text_decrease</Icon>;
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

export const GroupOffIcon: IconComponent = (props) => {
  return <Icon {...props}>group_off</Icon>;
};

export const HomeIcon: IconComponent = (props) => {
  return <Icon {...props}>home</Icon>;
};

export const GroupSearchIcon: IconComponent = (props) => {
  return <Icon {...props}>group_search</Icon>;
};

export const GroupAddIcon: IconComponent = (props) => {
  return <Icon {...props}>group_add</Icon>;
};

export const HistoryIcon: IconComponent = (props) => {
  return <Icon {...props}>history</Icon>;
};

export const InfoIcon: IconComponent = (props) => {
  return <Icon {...props}>info</Icon>;
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

export const LightbulbIcon: IconComponent = (props) => {
  return <Icon {...props}>lightbulb</Icon>;
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

export const MentionIcon: IconComponent = (props) => {
  return <Icon {...props}>alternate_email</Icon>;
};

export const MenuIcon: IconComponent = (props) => {
  return <Icon {...props}>menu</Icon>;
};

export const MemoryIcon: IconComponent = (props) => {
  return <Icon {...props}>memory</Icon>;
};

export const MergeCellsIcon: IconComponent = (props) => {
  return <Icon {...props}>merge_type</Icon>;
};

export const MoreVertIcon: IconComponent = (props) => {
  return <Icon {...props}>more_vert</Icon>;
};

export const MoreHorizIcon: IconComponent = (props) => {
  return <Icon {...props}>more_horiz</Icon>;
};

export const MoveItemIcon: IconComponent = (props) => {
  return <Icon {...props}>move_item</Icon>;
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

export const PDFIcon: IconComponent = (props) => {
  return <Icon {...props}>picture_as_pdf</Icon>;
};

export const PercentIcon: IconComponent = (props) => {
  return <Icon {...props}>percent</Icon>;
};

export const PromptIcon: IconComponent = (props) => {
  return <Icon {...props}>chat_paste_go</Icon>;
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

export const SyncIcon: IconComponent = (props) => {
  return <Icon {...props}>sync</Icon>;
};

export const SaveAndRunIcon: IconComponent = (props) => {
  return <Icon {...props}>play_arrow</Icon>;
};

export const SaveAndRunStopIcon: IconComponent = (props) => {
  return <Icon {...props}>stop</Icon>;
};

export const ScheduleIcon: IconComponent = (props) => {
  return <Icon {...props}>schedule</Icon>;
};

export const ScientificIcon: IconComponent = (props) => {
  return <Icon {...props}>functions</Icon>;
};

export const SearchIcon: IconComponent = (props) => {
  return <Icon {...props}>search</Icon>;
};

export const SettingsIcon: IconComponent = (props) => {
  return <Icon {...props}>settings</Icon>;
};

export const SheetIcon: IconComponent = (props) => {
  return <Icon {...props}>grid_on</Icon>;
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

export const StarShineIcon: IconComponent = (props) => {
  return <Icon {...props}>star_shine</Icon>;
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

export const TableRowsIcon: IconComponent = (props) => {
  return <Icon {...props}>table_rows</Icon>;
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

export const TuneIcon: IconComponent = (props) => {
  return <Icon {...props}>tune</Icon>;
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

export const UnmergeCellsIcon: IconComponent = (props) => {
  return <Icon {...props}>call_split</Icon>;
};

export const ZoomInIcon: IconComponent = (props) => {
  return <Icon {...props}>zoom_in</Icon>;
};

export const ZoomOutIcon: IconComponent = (props) => {
  return <Icon {...props}>zoom_out</Icon>;
};

export const TableEditIcon: IconComponent = (props) => {
  return <Icon {...props}>table_edit</Icon>;
};

export const TableConvertIcon: IconComponent = (props) => {
  return <Icon {...props}>table_convert</Icon>;
};

export const FlattenTableIcon: IconComponent = (props) => {
  return <Icon {...props}>view_compact</Icon>;
};

export const SortIcon: IconComponent = (props) => {
  return <Icon {...props}>sort</Icon>;
};

export const SortDescendingIcon: IconComponent = (props) => {
  return <Icon {...props}>sort</Icon>;
};

export const SortAscendingIcon: IconComponent = (props) => {
  const { className, ...rest } = props;
  return (
    <Icon {...rest} className={cn(className, 'rotate-180 scale-x-[-1]')}>
      sort
    </Icon>
  );
};

export const DragIndicatorIcon: IconComponent = (props) => {
  return <Icon {...props}>drag_indicator</Icon>;
};

export const UpArrowIcon: IconComponent = (props) => {
  return <Icon {...props}>arrow_upward</Icon>;
};

export const DownArrowIcon: IconComponent = (props) => {
  return <Icon {...props}>arrow_downward</Icon>;
};

export const HideIcon: IconComponent = (props) => {
  return <Icon {...props}>visibility_off</Icon>;
};

export const ShowIcon: IconComponent = (props) => {
  return <Icon {...props}>visibility</Icon>;
};

export const FileOpenIcon: IconComponent = (props) => {
  return <Icon {...props}>file_open</Icon>;
};

export const ArrowRightIcon: IconComponent = (props) => {
  return <Icon {...props}>keyboard_arrow_right</Icon>;
};

export const ArrowBackIcon: IconComponent = (props) => {
  return <Icon {...props}>arrow_back</Icon>;
};

export const ArrowDoubleRightIcon: IconComponent = (props) => {
  return <Icon {...props}>keyboard_double_arrow_right</Icon>;
};

export const ArrowDownIcon: IconComponent = (props) => {
  return <Icon {...props}>keyboard_arrow_down</Icon>;
};

export const ArrowDoubleDownIcon: IconComponent = (props) => {
  return <Icon {...props}>keyboard_double_arrow_down</Icon>;
};

export const ArrowSouthIcon: IconComponent = (props) => {
  return <Icon {...props}>south</Icon>;
};

export const LightedBulbIcon: IconComponent = (props) => {
  return (
    <Icon {...props} className={cn(props.className, 'rotate-180')}>
      wb_incandescent
    </Icon>
  );
};

export const PublicIcon: IconComponent = (props) => {
  return <Icon {...props}>public</Icon>;
};

export const PublicOffIcon: IconComponent = (props) => {
  return <Icon {...props}>public_off</Icon>;
};

export const SheetComeFromIcon: IconComponent = (props) => {
  return <Icon {...props}>step_out</Icon>;
};

export const SheetGoToIcon: IconComponent = (props) => {
  return <Icon {...props}>step_into</Icon>;
};

export const GenericLanguageIcon: IconComponent = (props) => {
  return <Icon {...props}>subject</Icon>;
};

export const WorkIcon: IconComponent = (props) => {
  return <Icon {...props}>domain</Icon>;
};

export const PersonalIcon: IconComponent = (props) => {
  return <Icon {...props}>cottage</Icon>;
};

export const RadioButtonUncheckedIcon: IconComponent = (props) => {
  return <Icon {...props}>radio_button_unchecked</Icon>;
};

export const RadioButtonCheckedIcon: IconComponent = (props) => {
  return <Icon {...props}>radio_button_checked</Icon>;
};

export const WebBrowserIcon: IconComponent = (props) => {
  return <Icon {...props}>captive_portal</Icon>;
};

export const ScheduledTasksIcon: IconComponent = (props) => {
  return <Icon {...props}>timer_play</Icon>;
};

export const WarningIcon: IconComponent = (props) => {
  return <Icon {...props}>warning</Icon>;
};

export const DesktopIcon: IconComponent = (props) => {
  return <Icon {...props}>computer</Icon>;
};

export const SyncingDoneIcon: IconComponent = (props) => {
  return <Icon {...props}>cloud_done</Icon>;
};
export const SyncingInProgressIcon: IconComponent = (props) => {
  return <Icon {...props}>cloud_sync</Icon>;
};
export const SyncingAlertIcon: IconComponent = (props) => {
  return <Icon {...props}>cloud_alert</Icon>;
};

export const BankIcon: IconComponent = (props) => {
  return <Icon {...props}>account_balance</Icon>;
};

export const BrokerageIcon: IconComponent = (props) => {
  return <Icon {...props}>finance_mode</Icon>;
};

export const CreditCardIcon: IconComponent = (props) => {
  return <Icon {...props}>credit_card</Icon>;
};
