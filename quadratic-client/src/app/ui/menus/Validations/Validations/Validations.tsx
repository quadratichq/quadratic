import { Button } from '@/shared/shadcn/ui/button';
import { useValidationsData } from './useValidationsData';
import { ValidationsHeader } from './ValidationsHeader';

export const Validations = () => {
  const validationsData = useValidationsData();
  const { validations } = validationsData;

  return (
    <div
      className="border-gray relative flex h-full flex-col border-l bg-background px-3 py-1 text-sm"
      style={{ width: '30rem' }}
    >
      <ValidationsHeader validationsData={validationsData} />

      <div className="grow">
        {validations?.map((validation) => (
          <div key={validation.id}></div>
        ))}
      </div>

      <div className="mt-3 flex w-full border-t border-t-gray-100 pt-2">
        <div className="mx-auto my-1 flex gap-3">
          <Button variant="secondary">Remove All</Button>
          <Button>Add Validation</Button>
        </div>
      </div>
    </div>
  );
};
