import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { OpenInNew } from '@mui/icons-material';
import { DOCUMENTATION_URL, BUG_REPORT_URL } from '../../../../constants/urls';
import { CommandPaletteListItemDynamicProps } from '../CommandPaletteListItem';

interface Props extends CommandPaletteListItemDynamicProps {
  sheetController: any;
  app: any;
}

export const CPLIHelpViewDocs = (props: any) => {
  const { sheetController, app, ...rest } = props;
  return (
    <CommandPaletteListItem
      icon={<OpenInNew />}
      action={() => {
        window.open(DOCUMENTATION_URL, '_blank')?.focus();
      }}
      {...rest}
    />
  );
};

export const CPLIHelpReportProblem = (props: any) => {
  const { sheetController, app, ...rest } = props;
  return (
    <CommandPaletteListItem
      icon={<OpenInNew />}
      action={() => {
        window.open(BUG_REPORT_URL, '_blank')?.focus();
      }}
      {...rest}
    />
  );
};
