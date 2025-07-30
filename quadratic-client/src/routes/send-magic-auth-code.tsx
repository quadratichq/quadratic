import { AuthFormWrapper } from '@/shared/components/auth/AuthFormWrapper';
import { SendMagicAuthCode } from '@/shared/components/auth/SendMagicAuthCode';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';

export const Component = () => {
  useRemoveInitialLoadingUI(true);

  return (
    <AuthFormWrapper>
      <SendMagicAuthCode />
    </AuthFormWrapper>
  );
};
