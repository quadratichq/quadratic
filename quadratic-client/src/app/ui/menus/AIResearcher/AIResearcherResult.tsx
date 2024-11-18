import { aiResearcherResultAtom } from '@/app/atoms/aiResearcherAtom';
import { useRecoilValue } from 'recoil';

export const AIResearcherResult = () => {
  const aiResearcherResult = useRecoilValue(aiResearcherResultAtom);

  if (!aiResearcherResult) {
    return null;
  }

  return (
    <div className="mx-3 mb-3 mt-1 flex flex-col gap-2 rounded-lg">
      <div>
        <span className="font-bold">{`Confidence Score: `}</span>
        {aiResearcherResult.toolCallArgs.confidence_score}
      </div>

      <div>
        <span className="font-bold">{`Source: `}</span>
        {aiResearcherResult.toolCallArgs.source_urls.map((url) => (
          <a key={url} href={url} target="_blank" rel="noreferrer" className="text-link underline">
            {url}
          </a>
        ))}
      </div>
    </div>
  );
};
