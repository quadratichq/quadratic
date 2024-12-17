import { aiResearcherResultAtom } from '@/app/atoms/aiResearcherAtom';
import { Markdown } from '@/app/ui/components/Markdown';
import { UrlPill } from '@/app/ui/components/UrlPill';
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
        <span className="font-bold">{aiResearcherResult.toolCallArgs.confidence_score * 100}%</span>
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
          <span>
            <Markdown>
              {aiResearcherResult.exaResults
                .map(
                  (result, index) => `
### Result ${index + 1}
- **Title**: ${result.title}
- **URL**: ${result.url}
${result.publishedDate ? `- **Published**: ${result.publishedDate}` : ''}
${result.author ? `- **Author**: ${result.author}` : ''}
${result.score !== null && result.score !== undefined ? `- **Score**: ${result.score}` : ''}

${result.highlights?.length ? '**Highlights**:\n' + result.highlights.map((h) => `> ${h}`).join('\n\n') : ''}

${result.summary || ''}

---
`
                )
                .join('\n')}
            </Markdown>
          </span>
        </div>
      )}
    </div>
  );
};
