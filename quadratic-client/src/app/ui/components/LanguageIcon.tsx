import { CodeCellIds } from '@/app/helpers/codeCellLanguage';
import { colors } from '@/app/theme/colors';
import { Formula, JavaScript, MssqlIcon, MysqlIcon, PostgresIcon, Python, SnowflakeIcon } from '@/app/ui/icons';
import { AIIcon } from '@/shared/components/Icons';
import { Subject } from '@mui/icons-material';
import { SvgIconProps } from '@mui/material/SvgIcon';

interface LanguageIconProps extends SvgIconProps {
  language?: CodeCellIds | string;
}

export function LanguageIcon({ language, ...props }: LanguageIconProps) {
  language = language ? language.toLowerCase() : language;

  // matches size of default material symbols icons
  const internalSx = { width: 20, height: 20, ...(props.sx ? props.sx : {}) };

  return language && 'airesearcher'.startsWith(language) ? (
    <AIIcon />
  ) : language && 'python'.startsWith(language) ? (
    <Python {...props} sx={{ color: colors.languagePython, ...internalSx }} />
  ) : language && 'formula'.startsWith(language) ? (
    <Formula {...props} sx={{ color: colors.languageFormula, ...internalSx }} />
  ) : language && 'javascript'.startsWith(language) ? (
    <JavaScript className="text-gray-700" sx={{ color: colors.languageJavascript, ...internalSx }} />
  ) : language && 'postgres'.startsWith(language) ? (
    <PostgresIcon {...props} sx={{ color: colors.languagePostgres, ...internalSx }} />
  ) : language && 'mysql'.startsWith(language) ? (
    <MysqlIcon {...props} sx={{ color: colors.languageMysql, ...internalSx }} />
  ) : language && 'mssql'.startsWith(language) ? (
    <MssqlIcon {...props} sx={{ color: colors.languageMssql, ...internalSx }} />
  ) : language && 'snowflake'.startsWith(language) ? (
    <SnowflakeIcon {...props} sx={{ color: colors.languageSnowflake, ...internalSx }} />
  ) : (
    <Subject {...props} />
  );
}
