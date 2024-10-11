import { aiResearcherOutputAtom } from '@/app/atoms/aiResearcherAtom';
import { useRecoilValue } from 'recoil';

export const AIResearcherOutput = () => {
  const output = useRecoilValue(aiResearcherOutputAtom);
  return (
    <div className="mx-3 mb-3 mt-1 flex flex-col gap-2 rounded-lg">
      <span className="font-bold">Output:</span>
      <span className="flex min-h-9 min-w-24 items-center gap-2 rounded-md border border-gray-300 px-2 py-1.5">
        {output}
      </span>
    </div>
  );
};
