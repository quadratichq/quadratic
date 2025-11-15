import { aiAnalystCurrentChatMessagesCountAtom } from '@/app/atoms/aiAnalystAtom';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { memo } from 'react';
import { useRecoilValue } from 'recoil';

export const AIAnalystEmptyStateWaypoint = memo(() => {
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);

  if (messagesCount > 0) {
    return null;
  }

  return (
    <div className="absolute left-0 right-0 top-full mt-2 select-none text-muted-foreground">
      <div className="ml-2.5 flex flex-col">
        <svg
          width="16"
          height="100"
          viewBox="0 0 16 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-border"
        >
          <path
            d="M8.70715 0.292894C8.31662 -0.0976309 7.68346 -0.0976312 7.29293 0.292893L0.92897 6.65685C0.538446 7.04738 0.538445 7.68054 0.928969 8.07106C1.31949 8.46159 1.95266 8.46159 2.34318 8.07107L8.00004 2.41421L13.6569 8.07107C14.0474 8.46159 14.6806 8.4616 15.0711 8.07107C15.4616 7.68055 15.4616 7.04738 15.0711 6.65686L8.70715 0.292894ZM8 100L9 100L9.00004 1L8.00004 1L7.00004 1L7 100L8 100Z"
            fill="currentColor"
          />
        </svg>
        <h3 className="mt-2 text-sm">File uploads</h3>
        <p className="hidden text-xs">PDF, Image, CSV, Excel, or Parquet</p>
      </div>
      <div className="absolute left-11 top-0 flex flex-row gap-2.5">
        <svg
          width="86"
          height="56"
          viewBox="0 0 86 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="flex-shrink-0 text-border"
        >
          <path
            d="M8.00005 54.9584L7.00005 54.9584L7.00004 55.9584L8.00005 55.9584L8.00005 54.9584ZM8.70807 0.292181C8.31755 -0.0983497 7.68439 -0.0983602 7.29386 0.292158L0.929789 6.65601C0.539259 7.04653 0.539248 7.6797 0.929766 8.07023C1.32028 8.46076 1.95345 8.46077 2.34398 8.07025L8.00093 2.41349L13.6577 8.07044C14.0482 8.46097 14.6814 8.46098 15.0719 8.07046C15.4624 7.67994 15.4624 7.04678 15.0719 6.65625L8.70807 0.292181ZM126 54.9587L126 53.9587L8.00006 53.9584L8.00005 54.9584L8.00005 55.9584L126 55.9587L126 54.9587ZM8.00005 54.9584L9.00005 54.9584L9.00095 0.999293L8.00095 0.999276L7.00095 0.999259L7.00005 54.9584L8.00005 54.9584Z"
            fill="currentColor"
          />
        </svg>
        <div className="mt-4 flex flex-col">
          <div className="flex flex-row gap-2 opacity-50 grayscale">
            <LanguageIcon language="postgres" />
            <LanguageIcon language="mysql" />
            <LanguageIcon language="mssql" />
          </div>
          <h3 className="mt-2 text-sm">Data connections</h3>
          <p className="hidden text-xs">Support for Postgres, MySQL, MSSQL, & more.</p>
        </div>
      </div>
    </div>
  );
});
