import { LiveChatWidget } from '@livechat/widget-react';
import { isMobileOnly } from 'react-device-detect';
import { useAuth0 } from '@auth0/auth0-react';

export const ChatSupportProvider = () => {
  const { user } = useAuth0();

  // Only track analytics on cloud version where REACT_APP_GOOGLE_ANALYTICS_GTAG is set
  if (!process.env.REACT_APP_LIVECHAT_LICENSE) {
    return null;
  }

  // Prevent loading on mobile
  if (isMobileOnly) {
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
