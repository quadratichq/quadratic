import { CheckIcon, ErrorIcon, HistoryIcon, SpinnerIcon } from '@/shared/components/Icons';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { cn } from '@/shared/shadcn/utils';
import type { ScheduledTaskLog } from 'quadratic-shared/typesAndSchemasScheduledTasks';
import { useCallback, useEffect, useRef, useState } from 'react';

const PAGE_SIZE = 30;
const SCROLL_THRESHOLD = 50;
const REFRESH_INTERVAL_MS = 10000;

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
  const isLoadingRef = useRef(false);

  // remove all duplicates from the history (earlier runs with the same run_id
  // replace later runs)
  const filterHistory = useCallback((items: ScheduledTaskLog[]) => {
    const uniqueItems = [];
    const seenItems = new Set<string>();
    for (const item of items) {
      if (!seenItems.has(item.runId)) {
        seenItems.add(item.runId);
        uniqueItems.push(item);
      }
    }
    return uniqueItems;
  }, []);

  // Fetch pages of history
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
            return filterHistory([...prev, ...data]);
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
    [filterHistory, getHistory]
  );

  // Keep the first page up to date with the latest runs
  useEffect(() => {
    const refreshFirstPage = async () => {
      if (currentTaskUuid) {
        const data = await getHistory(1, PAGE_SIZE);
        setHistory((prev) => {
          // Create a map of existing items by runId for quick lookup
          const existingMap = new Map(prev.map((item) => [item.runId, item]));
          const updated: ScheduledTaskLog[] = [];
          const seenIds = new Set<string>();

          // First, add new or updated items from the fresh data
          for (const item of data) {
            if (seenIds.has(item.runId)) continue;
            seenIds.add(item.runId);

            const existing = existingMap.get(item.runId);
            // Only update if the item is new or status has changed
            if (!existing || existing.status !== item.status) {
              updated.push(item);
            } else {
              updated.push(existing);
            }
          }

          // Then add remaining items that weren't in the fresh data
          for (const item of prev) {
            if (!seenIds.has(item.runId)) {
              seenIds.add(item.runId);
              updated.push(item);
            }
          }

          return updated;
        });
      }
    };
    let interval: number | undefined;
    if (currentTaskUuid) {
      setPage(1);
      setHasMore(true);
      setHistory([]);
      fetchHistory(1, false);
      interval = window.setInterval(refreshFirstPage, REFRESH_INTERVAL_MS);
    } else {
      setHistory([]);
      setLoading(false);
    }
    return () => {
      if (interval) {
        window.clearInterval(interval);
        interval = undefined;
      }
    };
  }, [currentTaskUuid, fetchHistory, getHistory]);

  const handleScrollRef = useRef<((this: HTMLDivElement, ev: Event) => void) | null>(null);

  const scrollContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Clean up previous listener
      if (handleScrollRef.current && node) {
        node.removeEventListener('scroll', handleScrollRef.current);
      }

      if (!node) return;

      const handleScroll = () => {
        if (isLoadingRef.current || !hasMore) return;

        const { scrollTop, scrollHeight, clientHeight } = node;
        if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD) {
          fetchHistory(page + 1, true);
        }
      };

      handleScrollRef.current = handleScroll;
      node.addEventListener('scroll', handleScroll);
    },
    [hasMore, page, fetchHistory]
  );

  const getStatusBadge = (status: ScheduledTaskLog['status']) => {
    const baseClasses = 'h-5 px-1 py-0.5 text-[10px] rounded leading-4'; // smaller height and font
    switch (status) {
      case 'COMPLETED':
        return (
          <Badge variant="default" className={`bg-green-500 hover:bg-green-600 ${baseClasses}`}>
            <CheckIcon className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="destructive" className={baseClasses}>
            <ErrorIcon className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      case 'RUNNING':
        return (
          <Badge variant="default" className={`bg-blue-500 hover:bg-blue-600 ${baseClasses}`}>
            <SpinnerIcon className="mr-1 h-3 w-3" />
            Running
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="secondary" className={baseClasses}>
            <HistoryIcon className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className={baseClasses}>
            {status}
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;

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
    <div className="mt-6 flex min-h-0 flex-1 flex-col">
      <h3 className="mb-3 text-sm font-semibold">Run History</h3>
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto border">
        <div className="px-2">
          {history.map((log, index) => (
            <div
              key={log.runId}
              className={cn(
                'group relative -mx-2 rounded px-2 py-2.5 transition-colors hover:bg-accent/30',
                index !== history.length - 1 && 'border-b border-border/40'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">{formatDate(log.createdDate)}</span>
                {getStatusBadge(log.status)}
              </div>
            </div>
          ))}
          <div className={cn('flex items-center justify-center py-3', !loadingMore && 'invisible')}>
            <SpinnerIcon className="text-muted-foreground" />
            <span className="ml-2 text-xs text-muted-foreground">Loading more...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
