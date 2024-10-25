import { CodeCellIds } from '@/app/helpers/codeCellLanguage';
import { colors } from '@/app/theme/colors';
import { Formula, JavaScript, MssqlIcon, MysqlIcon, PostgresIcon, Python, SnowflakeIcon } from '@/app/ui/icons';
import { Subject } from '@mui/icons-material';
import { SvgIconProps } from '@mui/material/SvgIcon';

interface LanguageIconProps extends SvgIconProps {
  language?: CodeCellIds | string;
}

export function LanguageIcon({ language, ...props }: LanguageIconProps) {
  language = language ? language.toLowerCase() : language;

  return language === 'python' ? (
    <Python {...props} sx={{ color: colors.languagePython, ...(props.sx ? props.sx : {}) }} />
  ) : language === 'formula' ? (
    <Formula {...props} sx={{ color: colors.languageFormula, ...(props.sx ? props.sx : {}) }} />
  ) : language === 'javascript' ? (
    <JavaScript className="text-gray-700" sx={{ color: colors.languageJavascript }} />
  ) : language === 'postgres' ? (
    <PostgresIcon {...props} sx={{ color: colors.languagePostgres, ...(props.sx ? props.sx : {}) }} />
  ) : language === 'mysql' ? (
    <MysqlIcon {...props} sx={{ color: colors.languageMysql, ...(props.sx ? props.sx : {}) }} />
  ) : language === 'mssql' ? (
    <MssqlIcon sx={{ color: colors.languageMssql, ...(props.sx ? props.sx : {}) }} />
  ) : language === 'snowflake' ? (
    <SnowflakeIcon sx={{ color: colors.languageSnowflake, ...(props.sx ? props.sx : {}) }} />
  ) : (
    <Subject {...props} />
  );
}
