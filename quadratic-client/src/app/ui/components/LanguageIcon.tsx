import { CodeCellIds } from '@/app/helpers/codeCellLanguage';
import { colors } from '@/app/theme/colors';
import { Formula, JavaScript, MssqlIcon, MysqlIcon, PostgresIcon, Python } from '@/app/ui/icons';
import { Subject } from '@mui/icons-material';
import { SvgIconProps } from '@mui/material/SvgIcon';

interface LanguageIconProps extends SvgIconProps {
  language?: CodeCellIds;
}

export function LanguageIcon({ language, ...props }: LanguageIconProps) {
  return language === 'Python' ? (
    <Python sx={{ color: colors.languagePython }} {...props} />
  ) : language === 'Formula' ? (
    <Formula sx={{ color: colors.languageFormula }} {...props} />
  ) : language === 'Javascript' ? (
    <JavaScript className="text-gray-700" sx={{ color: colors.languageJavascript }} />
  ) : language === 'POSTGRES' ? (
    <PostgresIcon sx={{ color: colors.languagePostgres }} {...props} />
  ) : language === 'MYSQL' ? (
    <MysqlIcon sx={{ color: colors.languageMysql }} {...props} />
  ) : language === 'MSSQL' ? (
    <MssqlIcon sx={{ color: colors.languageMssql }} {...props} />
  ) : (
    <Subject {...props} />
  );
}
