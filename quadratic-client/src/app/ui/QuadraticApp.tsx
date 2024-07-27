import { useEffect, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilValue } from 'recoil';
import { v4 } from 'uuid';

import { hasPermissionToEditFile } from '@/app/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useUndo } from '@/app/events/useUndo';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { QuadraticLoading } from '@/app/ui/loading/QuadraticLoading';
import QuadraticUIContext from '@/app/ui/QuadraticUIContext';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { useRootRouteLoaderData } from '@/routes/_root';

export function QuadraticApp() {
  const { loggedInUser } = useRootRouteLoaderData();

  const [loading, setLoading] = useState(true);
  const { permissions, uuid } = useRecoilValue(editorInteractionStateAtom);
  const didMount = useRef<boolean>(false);

  // Initialize loading of critical assets
  useEffect(() => {
    // Ensure this only runs once
    if (didMount.current) return;
    didMount.current = true;

    // Load python and populate web workers (if supported)
    if (!isMobile && hasPermissionToEditFile(permissions)) {
      pythonWebWorker.init();
      javascriptWebWorker.init();
    }
  }, [permissions]);

  useEffect(() => {
    if (uuid && !pixiApp.initialized) {
      pixiApp.init().then(() => {
        if (!loggedInUser) {
          const anonymous = { sub: v4(), first_name: 'Anonymous', last_name: 'User' };
          multiplayer.init(uuid, anonymous, true);
        } else {
          multiplayer.init(uuid, loggedInUser, false);
        }
        setLoading(false);
      });
    }
  }, [uuid, loggedInUser]);

  useUndo();

  if (loading) {
    return <QuadraticLoading />;
  }
  return <QuadraticUIContext />;
}
