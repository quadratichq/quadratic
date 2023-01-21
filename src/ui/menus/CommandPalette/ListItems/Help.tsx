import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { OpenInNew } from '@mui/icons-material';
import { DOCUMENTATION_URL, BUG_REPORT_URL } from '../../../../constants/urls';
import { ComposableCommandPaletteListItemProps } from '../CommandPaletteListItem';

export const CPLIHelpViewDocs = (props: ComposableCommandPaletteListItemProps) => {
  const { sheetController, app, ...rest } = props;
  return (
    <CommandPaletteListItem
      {...rest}
      icon={<OpenInNew />}
      action={() => {
        window.open(DOCUMENTATION_URL, '_blank')?.focus();
      }}
    />
  );
};

export const CPLIHelpReportProblem = (props: ComposableCommandPaletteListItemProps) => {
  const { sheetController, app, ...rest } = props;
  return (
    <CommandPaletteListItem
      {...rest}
      icon={<OpenInNew />}
      action={() => {
        window.open(BUG_REPORT_URL, '_blank')?.focus();
      }}
    />
  );
};
