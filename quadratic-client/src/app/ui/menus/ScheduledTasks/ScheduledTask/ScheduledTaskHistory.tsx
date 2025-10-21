import { CheckIcon, ErrorIcon, HistoryIcon, SpinnerIcon } from '@/shared/components/Icons';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import type { ScheduledTaskLog } from 'quadratic-shared/typesAndSchemasScheduledTasks';
import { useCallback, useEffect, useRef, useState } from 'react';

const PAGE_SIZE = 30;
const SCROLL_THRESHOLD = 50;

interface ScheduledTaskHistoryProps {
  getHistory: (pageNumber?: number, pageSize?: number) => Promise<ScheduledTaskLog[]>;
  currentTaskUuid?: string;
}

export const ScheduledTaskHistory = ({ getHistory, currentTaskUuid }: ScheduledTaskHistoryProps) => {
  const [history, setHistory] = useState<ScheduledTaskLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);

  const fetchHistory = useCallback(
    async (pageNum: number, append = false) => {
      if (isLoadingRef.current) return;

      isLoadingRef.current = true;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const data = await getHistory(pageNum, PAGE_SIZE);
        setHistory((prev) => {
          if (append) {
            // Filter out duplicates by checking existing IDs
            const existingIds = new Set(prev.map((log) => log.id));
            const newItems = data.filter((log) => !existingIds.has(log.id));
            return [...prev, ...newItems];
          }
          return data;
        });
        setHasMore(data.length === PAGE_SIZE);
        if (append) {
          setPage(pageNum);
        }
      } catch (error) {
        console.error('Failed to fetch history:', error);
        if (!append) {
          setHistory([]);
        }
      } finally {
        isLoadingRef.current = false;
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [getHistory]
  );

  useEffect(() => {
    if (currentTaskUuid) {
      setPage(1);
      setHasMore(true);
      setHistory([]);
      fetchHistory(1, false);
    } else {
      setHistory([]);
      setLoading(false);
    }
  }, [currentTaskUuid, fetchHistory]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || isLoadingRef.current || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = container;

    if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD) {
      const nextPage = page + 1;
      fetchHistory(nextPage, true);
    }
  }, [hasMore, page, fetchHistory]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const getStatusBadge = (status: ScheduledTaskLog['status']) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <CheckIcon className="mr-1" />
            Completed
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="destructive">
            <ErrorIcon className="mr-1" />
            Failed
          </Badge>
        );
      case 'RUNNING':
        return (
          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
            <SpinnerIcon className="mr-1" />
            Running
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="secondary">
            <HistoryIcon className="mr-1" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold">Run History</h3>
        <div className="space-y-1 border">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2 py-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold">Run History</h3>
        <p className="text-sm text-muted-foreground">No runs yet</p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col">
      <h3 className="mb-3 text-sm font-semibold">Run History</h3>
      <div ref={scrollContainerRef} className="max-h-[300px] overflow-y-auto">
        <div className="space-y-1 border">
          {history.map((log) => (
            <div key={log.id} className="py-2">
              <div className="flex items-center gap-2">
                {getStatusBadge(log.status)}
                <span className="text-xs text-muted-foreground">{formatDate(log.createdDate)}</span>
              </div>
              {log.error && (
                <div className="ml-1 mt-1">
                  <p className="text-xs text-destructive">{log.error}</p>
                </div>
              )}
            </div>
          ))}
          {loadingMore && (
            <div className="flex items-center justify-center py-3">
              <SpinnerIcon className="text-muted-foreground" />
              <span className="ml-2 text-xs text-muted-foreground">Loading more...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
