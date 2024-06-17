import { ROUTES } from '@/shared/constants/routes';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

export const useTeamRouteDialog = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { teamUuid } = useParams() as { teamUuid: string };
  const [open, setOpen] = useState(true);

  // Open by default. When it closes, close it immediately then navigate.
  useEffect(() => {
    if (!open) {
      if (location.key !== 'default') {
        navigate(-1);
      } else {
        navigate(ROUTES.TEAM(teamUuid));
      }
    }
  }, [open, navigate, teamUuid, location.key]);

  return {
    open,
    onClose: () => setOpen(false),
  };
};
