import { CodeCellIds } from '@/app/helpers/codeCellLanguage';
import { colors } from '@/app/theme/colors';
import { Formula, JavaScript, MysqlIcon, PostgresIcon, Python } from '@/app/ui/icons';
import { Subject } from '@mui/icons-material';
import { SvgIconProps } from '@mui/material/SvgIcon';

interface LanguageIconProps extends SvgIconProps {
  language?: CodeCellIds | string;
}

export function LanguageIcon({ language, ...props }: LanguageIconProps) {
  return language === 'Python' ? (
    <Python {...props} sx={{ color: colors.languagePython, ...(props.sx ? props.sx : {}) }} />
  ) : language === 'Formula' ? (
    <Formula {...props} sx={{ color: colors.languageFormula, ...(props.sx ? props.sx : {}) }} />
  ) : language === 'Javascript' ? (
    <JavaScript className="text-gray-700" sx={{ color: colors.languageJavascript }} />
  ) : language === 'POSTGRES' ? (
    <PostgresIcon {...props} sx={{ color: colors.languagePostgres, ...(props.sx ? props.sx : {}) }} />
  ) : language === 'MYSQL' ? (
    <MysqlIcon {...props} sx={{ color: colors.languageMysql, ...(props.sx ? props.sx : {}) }} />
  ) : (
    <Subject {...props} />
  );
}
