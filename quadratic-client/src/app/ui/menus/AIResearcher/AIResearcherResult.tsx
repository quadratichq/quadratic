import { aiResearcherResultAtom } from '@/app/atoms/aiResearcherAtom';
import { Markdown } from '@/app/ui/components/Markdown';
import { UrlPill } from '@/app/ui/components/UrlPill';
import { cn } from '@/shared/shadcn/utils';
import { useRecoilValue } from 'recoil';

export const AIResearcherResult = () => {
  const aiResearcherResult = useRecoilValue(aiResearcherResultAtom);

  if (!aiResearcherResult) {
    return null;
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-2">
      <div>
        <span>{`Confidence Score: `}</span>
        <span className="font-bold">{Math.round(aiResearcherResult.toolCallArgs.confidence_score * 100)}%</span>
      </div>

      {aiResearcherResult.toolCallArgs.source_urls.length > 0 && (
        <div className="flex flex-row flex-wrap items-center gap-2">
          <span>{`Source: `}</span>
          {aiResearcherResult.toolCallArgs.source_urls.map((url) => (
            <UrlPill key={url} url={url} />
          ))}
        </div>
      )}

      {aiResearcherResult.autopromptString && (
        <div>
          <span>{`Autoprompt: `}</span>
          <span className="whitespace-pre-wrap">{aiResearcherResult.autopromptString}</span>
        </div>
      )}

      {aiResearcherResult.exaResults && (
        <div>
          <span>{`Results: `}</span>

          <div className="flex flex-col gap-2">
            {aiResearcherResult.exaResults.map((result, index) => (
              <div
                key={`${index}-${result.title}`}
                className={cn(
                  index !== (aiResearcherResult.exaResults?.length ?? 0) - 1 && 'border-b border-border pb-2'
                )}
              >
                <div>{`${index + 1}. ${result.title}`}</div>

                <div>
                  <span>{`- URL: `}</span>
                  <a target="_blank" rel="noreferrer" href={result.url} className="text-link underline">
                    {result.url}
                  </a>
                </div>

                {result.publishedDate && (
                  <div>
                    <span>{`- Published: `}</span>
                    <span>{new Date(result.publishedDate).toLocaleDateString()}</span>
                  </div>
                )}

                {result.author && (
                  <div>
                    <span>{`- Author: `}</span>
                    <span>{result.author}</span>
                  </div>
                )}

                {result.score !== null && result.score !== undefined && (
                  <div>
                    <span>{`- Score: `}</span>
                    <span>{result.score}</span>
                  </div>
                )}

                {result.text && (
                  <div>
                    <span>{`- Text: `}</span>
                    <Markdown>{result.text}</Markdown>
                  </div>
                )}

                {result.highlights?.length && (
                  <div>
                    <span>{`- Highlights: `}</span>
                    <Markdown>{result.highlights.map((h) => `> ${h}`).join('\n\n')}</Markdown>
                  </div>
                )}

                {result.summary && (
                  <div>
                    <span>{`- Summary: `}</span>
                    <Markdown>{result.summary}</Markdown>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
