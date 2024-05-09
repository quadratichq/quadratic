import { ROUTES } from '@/shared/constants/routes';
import { NavLink, useParams } from 'react-router-dom';

export const ConnectionsBreadcrumb = () => {
  const { uuid, connectionType, connectionUuid } = useParams();
  return (
    <nav className="mb-0.5 flex items-center gap-2 text-xs">
      <NavLink
        to={ROUTES.FILE_CONNECTIONS(uuid ?? '')}
        end
        replace
        className={({ isActive }) =>
          isActive ? 'pointer-events-none text-muted-foreground opacity-50' : 'text-primary hover:underline'
        }
      >
        Connections
      </NavLink>

      <NavLink
        to={ROUTES.FILE_CONNECTIONS_CREATE(uuid ?? '', connectionType ?? '')}
        end
        replace
        className={({ isActive }) => (isActive ? 'before:mr-2 before:content-["›"]' : 'hidden')}
      >
        Create
      </NavLink>

      <NavLink
        to={ROUTES.FILE_CONNECTION(uuid ?? '', connectionUuid ?? 'foo')}
        end
        replace
        className={({ isActive }) => (isActive ? 'before:mr-2 before:content-["›"]' : 'hidden')}
      >
        Edit
      </NavLink>
    </nav>
  );
};
