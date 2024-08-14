import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { ReactNode } from 'react';

export const ConnectionHeader = ({ type, children }: { type: ConnectionType; children: ReactNode }) => {
  const { name } = connectionsByType[type];
  return (
    <h3 className="text-md flex gap-3 py-4">
      <LanguageIcon language={type} /> {children} {name} connection
    </h3>
  );
};
