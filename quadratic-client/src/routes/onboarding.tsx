import { requireAuth } from '@/auth/auth';
import { Onboarding } from '@/dashboard/onboarding/Onboarding';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { RecoilRoot } from 'recoil';

export const loader = async () => {
  await requireAuth();
  return null;
};

export const Component = () => {
  useRemoveInitialLoadingUI();
  return (
    <RecoilRoot>
      <Onboarding />
    </RecoilRoot>
  );
};

// TODO: action
