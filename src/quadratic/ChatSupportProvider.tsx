import { LiveChatWidget } from '@livechat/widget-react';
import { isMobileOnly } from 'react-device-detect';
import { useAuth0 } from '@auth0/auth0-react';
import { envVarToBool } from '../utils/envVarToBool';

export const ChatSupportProvider = () => {
  const { user } = useAuth0();

  // Check feature flag for livechat
  if (!envVarToBool(process.env.REACT_APP_LIVECHAT_ENABLED)) return null;

  // Prevent loading on mobile
  if (isMobileOnly) {
    return null;
  }

  // make sure we have what we need to load the widget
  if (!(process.env.REACT_APP_LIVECHAT_LICENSE && process.env.REACT_APP_LIVECHAT_GROUP)) {
    return null;
  }

  return (
    <LiveChatWidget
      license={process.env.REACT_APP_LIVECHAT_LICENSE}
      group={process.env.REACT_APP_LIVECHAT_GROUP}
      customerName={user?.name}
      customerEmail={user?.email}
    />
  );
};
