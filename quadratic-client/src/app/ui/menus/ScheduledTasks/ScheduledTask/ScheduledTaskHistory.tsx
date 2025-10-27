import { CheckCircleIcon, ErrorIcon, ScheduleIcon, SpinnerIcon } from '@/shared/components/Icons';
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

  // Mark old RUNNING/PENDING jobs as FAILED if there's a newer run
  const markSupplantedJobsAsFailed = useCallback((items: ScheduledTaskLog[]) => {
    if (items.length === 0) return items;

    const mostRecentRunId = items[0].runId;
    return items.map((item, index) => {
      if (index === 0) return item;

      // If this is an older run and it's still RUNNING or PENDING, mark it as FAILED
      if (item.runId !== mostRecentRunId && (item.status === 'RUNNING' || item.status === 'PENDING')) {
        return { ...item, status: 'FAILED' as const };
      }

      return item;
    });
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
          const merged = append ? filterHistory([...prev, ...data]) : data;
          return markSupplantedJobsAsFailed(merged);
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
    [filterHistory, getHistory, markSupplantedJobsAsFailed]
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

          return markSupplantedJobsAsFailed(updated);
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
  }, [currentTaskUuid, fetchHistory, getHistory, markSupplantedJobsAsFailed]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <h3 className="text-sm font-medium">Run history</h3>
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto rounded border px-2 py-1 shadow-sm">
        {loading ? (
          [1, 2, 3].map((i) => <RowItemLoader key={i} />)
        ) : history.length === 0 ? (
          <p className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No runs yet</p>
        ) : (
          <>
            {history.map((log, index) => (
              <RowItem key={log.runId} status={log.status} created={log.createdDate} />
            ))}

            <RowItemLoader className={cn(!loadingMore && 'invisible')} />
          </>
        )}
      </div>
    </div>
  );
};

function RowItemLoader({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-9 w-full items-center gap-2 py-2', className)}>
      <div className="flex h-5 w-5 items-center justify-center">
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="ml-auto h-3 w-12" />
    </div>
  );
}

function RowItem({ status, created }: { status: ScheduledTaskLog['status']; created: string }) {
  const baseClasses = 'flex items-center gap-2 h-9 w-full text-xs rounded leading-4 font-medium'; // smaller height and font
  const datetime = <time dateTime={created}>{formatDate(created)}</time>;

  if (status === 'COMPLETED') {
    return (
      <span className={cn(baseClasses, 'text-muted-foreground')}>
        <CheckCircleIcon />
        {datetime}
        <span className="ml-auto">Completed</span>
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span className={cn(baseClasses, 'text-destructive')}>
        <ErrorIcon />
        {datetime}
        <span className="ml-auto">Failed</span>
      </span>
    );
  }
  if (status === 'RUNNING') {
    return (
      <span className={cn(baseClasses, `text-primary`)}>
        <SpinnerIcon />
        {datetime}
        <span className="ml-auto">Running</span>
      </span>
    );
  }
  if (status === 'PENDING') {
    return (
      <span className={baseClasses}>
        <ScheduleIcon />
        {datetime}
        <span className="ml-auto">Pending</span>
      </span>
    );
  }
  return null;
}

function formatDate(dateString: string) {
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
}
