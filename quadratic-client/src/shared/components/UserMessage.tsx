import { userMessageAtom } from '@/app/atoms/userMessageAtom';
import { SlideUpBottomAlert } from '@/shared/components/SlideUpBottomAlert';
import { Type } from '@/shared/components/Type';
import { useRecoilValue } from 'recoil';

export function UserMessage() {
  const { message } = useRecoilValue(userMessageAtom);

  if (!message) {
    return null;
  }

  return (
    <SlideUpBottomAlert>
      <Type className="flex-grow">{message}</Type>
    </SlideUpBottomAlert>
  );
}
