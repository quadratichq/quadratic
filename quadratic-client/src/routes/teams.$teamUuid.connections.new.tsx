import { ConnectionsNew } from '@/shared/components/connections/ConnectionsNew';

import { useNavigate } from 'react-router';

export const Component = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl pt-3">
      <ConnectionsNew
        // type={undefined}
        handleNavigateToCreateView={(type) => {
          navigate(`./${type.toLowerCase()}`);
        }}
        handleNavigateToCreatePotentialView={() => {}}
      />
    </div>
  );
};
