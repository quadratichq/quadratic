import { ChevronRightIcon } from '@/shared/components/Icons';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

interface BreadcrumbItem {
  name: string;
  href?: string;
}

function BreadcrumbSegment({ item, isLast, isLink }: { item: BreadcrumbItem; isLast: boolean; isLink: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {item.href && isLink ? (
        <Link to={item.href} className="truncate text-muted-foreground no-underline hover:text-foreground">
          {item.name}
        </Link>
      ) : (
        <span className={isLast ? 'truncate font-medium' : 'truncate text-muted-foreground'}>{item.name}</span>
      )}
    </span>
  );
}

function MeasureStrip({
  items,
  collapsed,
  minimal,
  className,
}: {
  items: BreadcrumbItem[];
  collapsed: boolean;
  minimal: boolean;
  className?: string;
}) {
  if (items.length === 0) return null;
  const root = items[0];
  const current = items[items.length - 1];
  const middle = items.slice(1, -1);

  if (minimal) {
    return (
      <span className={className}>
        <span className="font-medium">{current.name}</span>
      </span>
    );
  }
  if (collapsed && middle.length > 0) {
    return (
      <span className={className}>
        <span className="truncate text-muted-foreground">{root.name}</span>
        <ChevronRightIcon className="shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">…</span>
        <ChevronRightIcon className="shrink-0 text-muted-foreground" />
        <span className="font-medium">{current.name}</span>
      </span>
    );
  }
  return (
    <span className={className}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="inline-flex shrink-0 items-center gap-0.5">
            {index > 0 && <ChevronRightIcon className="shrink-0 text-muted-foreground" />}
            <BreadcrumbSegment item={item} isLast={isLast} isLink={!!item.href && !isLast} />
          </span>
        );
      })}
    </span>
  );
}

export function FolderBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureFullRef = useRef<HTMLSpanElement>(null);
  const measureCollapsedRef = useRef<HTMLSpanElement>(null);
  const measureMinimalRef = useRef<HTMLSpanElement>(null);

  const [displayMode, setDisplayMode] = useState<'full' | 'collapsed' | 'minimal'>('full');

  const updateMode = useCallback(() => {
    const container = containerRef.current;
    const fullEl = measureFullRef.current;
    const collapsedEl = measureCollapsedRef.current;
    const minimalEl = measureMinimalRef.current;

    if (!container || !fullEl) return;

    const containerWidth = container.getBoundingClientRect().width;
    const fullWidth = fullEl.scrollWidth;
    const collapsedWidth = collapsedEl?.scrollWidth ?? Infinity;
    const minimalWidth = minimalEl?.scrollWidth ?? Infinity;

    const hasMiddle = items.length > 2;

    if (fullWidth <= containerWidth) {
      setDisplayMode('full');
    } else if (hasMiddle && collapsedWidth <= containerWidth) {
      setDisplayMode('collapsed');
    } else if (hasMiddle && minimalWidth < containerWidth) {
      setDisplayMode('minimal');
    } else if (!hasMiddle && fullWidth > containerWidth) {
      setDisplayMode('minimal');
    } else {
      setDisplayMode('minimal');
    }
  }, [items.length]);

  useLayoutEffect(() => {
    updateMode();
  }, [items, updateMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(updateMode);
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateMode]);

  if (items.length === 0) return null;

  const root = items[0];
  const current = items[items.length - 1];

  return (
    <>
      {/* Off-screen measure strips – same styling as visible breadcrumb for accurate width */}
      <div
        aria-hidden
        className="pointer-events-none absolute text-sm"
        style={{ left: -9999, top: 0, position: 'absolute' }}
      >
        <span ref={measureFullRef} className="inline-flex items-center gap-0.5 whitespace-nowrap">
          <MeasureStrip items={items} collapsed={false} minimal={false} />
        </span>
      </div>
      {items.length > 2 && (
        <div
          aria-hidden
          className="pointer-events-none absolute text-sm"
          style={{ left: -9999, top: 0, position: 'absolute' }}
        >
          <span ref={measureCollapsedRef} className="inline-flex items-center gap-0.5 whitespace-nowrap">
            <MeasureStrip items={items} collapsed={true} minimal={false} />
          </span>
        </div>
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute text-sm"
        style={{ left: -9999, top: 0, position: 'absolute' }}
      >
        <span ref={measureMinimalRef} className="inline-flex items-center gap-0.5 whitespace-nowrap">
          <MeasureStrip items={items} collapsed={false} minimal={true} />
        </span>
      </div>

      <nav ref={containerRef} className="flex min-w-0 flex-1 items-center gap-0.5 text-sm" aria-label="breadcrumb">
        {displayMode === 'full' && (
          <div className="flex min-w-0 items-center gap-0.5 overflow-hidden">
            {items.map((item, index) => {
              const isLast = index === items.length - 1;
              return (
                <span key={index} className="flex shrink-0 items-center gap-0.5">
                  {index > 0 && <ChevronRightIcon className="shrink-0 text-muted-foreground" />}
                  <BreadcrumbSegment item={item} isLast={isLast} isLink={!!item.href && !isLast} />
                </span>
              );
            })}
          </div>
        )}

        {displayMode === 'collapsed' && (
          <div className="flex min-w-0 items-center gap-0.5 overflow-hidden">
            <span className="flex shrink-0 items-center gap-0.5">
              {root.href ? (
                <Link
                  to={root.href}
                  className="min-w-0 truncate text-muted-foreground no-underline hover:text-foreground"
                >
                  {root.name}
                </Link>
              ) : (
                <span className="truncate text-muted-foreground">{root.name}</span>
              )}
            </span>
            <ChevronRightIcon className="shrink-0 text-muted-foreground" />
            <span className="shrink-0 text-muted-foreground">…</span>
            <ChevronRightIcon className="shrink-0 text-muted-foreground" />
            <span className="shrink-0 font-medium">{current.name}</span>
          </div>
        )}

        {displayMode === 'minimal' && (
          <div className="flex min-w-0 items-center gap-0.5 overflow-hidden">
            {items.length > 1 && (
              <>
                <span className="shrink-0 text-muted-foreground">…</span>
                <ChevronRightIcon className="shrink-0 text-muted-foreground" />
              </>
            )}
            <span className="shrink-0 truncate font-medium" title={current.name}>
              {current.name}
            </span>
          </div>
        )}
      </nav>
    </>
  );
}
