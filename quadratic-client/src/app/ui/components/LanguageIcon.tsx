import { CodeCellIds } from '@/app/helpers/codeCellLanguage';
import { colors } from '@/app/theme/colors';
import { Formula, JavaScript, MssqlIcon, MysqlIcon, PostgresIcon, Python, SnowflakeIcon } from '@/app/ui/icons';
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
    <JavaScript sx={{ color: colors.languageJavascript, ...(props.sx ? props.sx : {}) }} />
  ) : language === 'POSTGRES' ? (
    <PostgresIcon {...props} sx={{ color: colors.languagePostgres, ...(props.sx ? props.sx : {}) }} />
  ) : language === 'MYSQL' ? (
    <MysqlIcon {...props} sx={{ color: colors.languageMysql, ...(props.sx ? props.sx : {}) }} />
  ) : language === 'MSSQL' ? (
    <MssqlIcon sx={{ color: colors.languageMssql, ...(props.sx ? props.sx : {}) }} />
  ) : language === 'SNOWFLAKE' ? (
    <SnowflakeIcon sx={{ color: colors.languageSnowflake, ...(props.sx ? props.sx : {}) }} />
  ) : (
    <Subject {...props} />
  );
}
