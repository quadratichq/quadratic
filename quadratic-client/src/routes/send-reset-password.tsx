import { AuthFormWrapper } from '@/shared/components/auth/AuthFormWrapper';
import { SendResetPassword } from '@/shared/components/auth/SendResetPassword';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';

export const Component = () => {
  useRemoveInitialLoadingUI(true);

  return (
    <AuthFormWrapper>
      <SendResetPassword />
    </AuthFormWrapper>
  );
};
