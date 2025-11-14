import { codeCellsById } from '@/app/helpers/codeCellLanguage';
import { ChevronLeftIcon, DatabaseIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { Button } from '@/shared/shadcn/ui/button';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

interface Connection {
  uuid: string;
  name: string;
  type: ConnectionType;
}

interface ConnectionSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connections: Connection[];
  teamUuid: string;
  isPrivate: boolean;
  onSelectConnection: (connectionUuid: string, connectionType: ConnectionType) => void;
  onCreateNew: () => void;
  onBack?: () => void;
}

export function ConnectionSelectorDialog({
  open,
  onOpenChange,
  connections,
  teamUuid,
  isPrivate,
  onSelectConnection,
  onCreateNew,
  onBack,
}: ConnectionSelectorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {onBack && (
              <Button type="button" variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                <ChevronLeftIcon />
              </Button>
            )}
            <div className="flex-1">
              <DialogTitle className="text-center text-2xl font-bold">Select a database connection</DialogTitle>
              <DialogDescription className="text-center">
                Choose an existing connection or create a new one to get started with AI
              </DialogDescription>
            </div>
            {onBack && <div className="w-8"></div>}
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          {connections.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {connections.map(({ uuid, name, type }) => {
                const { label } = codeCellsById[type];
                return (
                  <button
                    key={uuid}
                    onClick={() => {
                      onSelectConnection(uuid, type);
                      onOpenChange(false);
                    }}
                    className="group relative flex select-none items-center gap-3 rounded-lg border border-border px-4 py-3 text-left font-medium shadow-sm hover:border-primary hover:shadow-md active:bg-accent"
                  >
                    <div className="flex-shrink-0">
                      <LanguageIcon language={type} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col items-start text-left">
                      <span className="w-full truncate text-left">{name}</span>
                      <span className="text-left text-xs text-muted-foreground">{label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <DatabaseIcon size="lg" className="mx-auto mb-2 opacity-50" />
              <p>No database connections yet</p>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => {
              onCreateNew();
              onOpenChange(false);
            }}
            className="w-full"
          >
            <DatabaseIcon className="mr-2" />
            Create new connection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
