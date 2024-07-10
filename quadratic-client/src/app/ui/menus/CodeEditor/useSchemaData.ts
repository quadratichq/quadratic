import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { editorSchemaStateAtom } from '@/app/atoms/editorSchemaStateAtom';
import { getConnectionInfo } from '@/app/helpers/codeCellLanguage';
import { connectionClient } from '@/shared/api/connectionClient';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export type SchemaData = Awaited<ReturnType<typeof connectionClient.schemas.get>>;
export type LoadState = 'not-initialized' | 'loading' | 'loaded' | 'error';

// highlight the return line and add a return icon next to the line number
export const useSchemaData = () => {
  const { mode } = useRecoilValue(editorInteractionStateAtom);
  const [data, setData] = useRecoilState(editorSchemaStateAtom);

  // needs to be a ref to ensure only fetch is only called once
  const connection = getConnectionInfo(mode);
  if (!connection) throw new Error('Expected a connection cell to be open.');

  const loadState = useRef<LoadState>('not-initialized');

  const fetchData = useCallback(async () => {
    if (loadState.current === 'loading') return;

    loadState.current = 'loading';

    const newSchemaData = await connectionClient.schemas.get(connection.kind.toLowerCase() as any, connection.id);

    if (newSchemaData) {
      setData({
        schema: newSchemaData,
      });
      loadState.current = 'loaded';
    } else {
      loadState.current = 'error';
    }
  }, [connection.id, connection.kind, setData]);

  useEffect(() => {
    if (loadState.current === 'not-initialized') {
      fetchData();
    }
  }, [fetchData, loadState]);

  return { loadState, data, fetchData };
};
