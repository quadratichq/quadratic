import { aiResearcherResultAtom } from '@/app/atoms/aiResearcherAtom';
import { UrlPill } from '@/app/ui/components/UrlPill';
import { useRecoilValue } from 'recoil';

export const AIResearcherResult = () => {
  const aiResearcherResult = useRecoilValue(aiResearcherResultAtom);

  if (!aiResearcherResult) {
    return null;
  }

  return (
    <div className="mx-3 mb-3 mt-1 flex flex-col gap-2 rounded-lg">
      <div>
        <span>{`Confidence Score: `}</span>
        <span className="font-bold">{aiResearcherResult.toolCallArgs.confidence_score * 100}%</span>
      </div>

      <div className="flex flex-row flex-wrap items-center gap-2">
        <span>{`Source:`}</span>
        {aiResearcherResult.toolCallArgs.source_urls.map((url) => (
          <UrlPill key={url} url={url} />
        ))}
      </div>
    </div>
  );
};
