// import { ConnectionFormMysql } from '@/app/ui/connections/ConnectionFormMysql';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { ConnectionFormTypePostgres } from './ConnectionFormTypePostgres';

type Props = {
  type: ConnectionType;
  initialData?: any;
  handleNavigateToListView: () => void;
};

// TODO: (connections) refine types
export const ConnectionForm = ({ type, initialData, handleNavigateToListView }: Props) => {
  let formProps = {
    handleNavigateToListView,
    initialData,
  };

  let form = (() => {
    switch (type) {
      case 'POSTGRES':
        return <ConnectionFormTypePostgres {...formProps} />;
      // case 'MYSQL':
      //   return <ConnectionFormMysql {...formProps} />;
      default:
        // This should never happen
        return <div>Form not found</div>;
    }
  })();

  return <>{form}</>;
};
