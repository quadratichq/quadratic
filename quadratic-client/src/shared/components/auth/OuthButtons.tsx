import { authClient, type OAuthProvider } from '@/auth/auth';
import {
  AppleOAuthLogo,
  GitHubOAuthLogo,
  GoogleOAuthLogo,
  MicrosoftOAuthLogo,
} from '@/shared/components/auth/OAuthLogo';
import { Button } from '@/shared/shadcn/ui/button';
import { getRedirectToOrLoginResult } from '@/shared/utils/getRedirectToOrLoginResult';
import { memo, useCallback } from 'react';

export const OAuthButtons = memo(() => {
  const handleOAuth = useCallback(async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    try {
      e.preventDefault();
      e.stopPropagation();

      if (['GoogleOAuth', 'MicrosoftOAuth', 'GitHubOAuth', 'AppleOAuth'].includes(e.currentTarget.value)) {
        const provider = e.currentTarget.value as OAuthProvider;
        const redirectTo = getRedirectToOrLoginResult();
        await authClient.loginWithOAuth({ provider, redirectTo });
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  return (
    <>
      <div className="flex w-full items-center gap-4">
        <div className="flex-1 border-t border-gray-300"></div>
        <span className="text-sm text-gray-500">OR</span>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>

      <div className="flex w-full flex-row gap-4">
        <Button
          type="button"
          value="GoogleOAuth"
          onClick={handleOAuth}
          variant="outline"
          className="flex h-12 w-full items-center justify-center"
        >
          <GoogleOAuthLogo />
        </Button>

        <Button
          type="button"
          value="MicrosoftOAuth"
          onClick={handleOAuth}
          variant="outline"
          className="flex h-12 w-full items-center justify-center"
        >
          <MicrosoftOAuthLogo />
        </Button>

        <Button
          type="button"
          value="GitHubOAuth"
          onClick={handleOAuth}
          variant="outline"
          className="flex h-12 w-full items-center justify-center"
        >
          <GitHubOAuthLogo />
        </Button>

        <Button
          type="button"
          value="AppleOAuth"
          onClick={handleOAuth}
          variant="outline"
          className="flex h-12 w-full items-center justify-center"
        >
          <AppleOAuthLogo />
        </Button>
      </div>
    </>
  );
});
