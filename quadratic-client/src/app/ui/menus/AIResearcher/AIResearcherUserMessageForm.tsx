import { aiResearcherQueryAtom } from '@/app/atoms/aiResearcherAtom';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { useRecoilState } from 'recoil';

type AIResearcherUserMessageFormProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
};

export const AIResearcherUserMessageForm = ({ textareaRef }: AIResearcherUserMessageFormProps) => {
  const [query, setQuery] = useRecoilState(aiResearcherQueryAtom);

  return (
    <Textarea
      ref={textareaRef}
      value={query}
      className="min-h-14 rounded-none border-none px-4 py-2 pb-0 shadow-none focus-visible:ring-0"
      onChange={(event) => setQuery(event.target.value)}
      autoComplete="off"
      placeholder="Enter your query for the researcher..."
      autoHeight={true}
      autoFocus={true}
    />
  );
};
