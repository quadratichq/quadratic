import { Avatar } from '@/shared/components/Avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useMemo, useState } from 'react';

interface TeamUser {
  id: number;
  email: string;
  name?: string;
  picture?: string;
  role: string;
}

export interface TeamAIUsageChartProps {
  users: TeamUser[];
  userUsageData: ApiTypes['/v0/teams/:uuid/billing/ai/usage/users.GET.response'] | null;
  dailyUsageData: ApiTypes['/v0/teams/:uuid/billing/ai/usage/daily.GET.response'] | null;
  monthlyAiAllowance: number | null;
  isBusiness: boolean;
  planType: string;
  isLoadingDaily: boolean;
  onModeChange: (mode: 'daily' | 'monthly') => void;
}

type ChartMode = 'daily' | 'monthly';

interface MonthlyBarData {
  user: TeamUser;
  included: number;
  overage: number;
  total: number;
  label: string;
}

interface DailyBarData {
  date: string;
  dateLabel: string;
  segments: Array<{
    userId: number;
    userName: string;
    value: number;
    billedOverageCost: number;
  }>;
  total: number;
}

const CHART_HEIGHT = 160;
const LABEL_AREA_HEIGHT = 40;
const BAR_AREA_HEIGHT = CHART_HEIGHT - LABEL_AREA_HEIGHT;

const USER_COLORS = [
  'hsl(221 83% 53% / 0.7)',
  'hsl(262 83% 58% / 0.7)',
  'hsl(160 60% 45% / 0.7)',
  'hsl(30 80% 55% / 0.7)',
  'hsl(340 75% 55% / 0.7)',
  'hsl(200 70% 50% / 0.7)',
  'hsl(45 85% 50% / 0.7)',
  'hsl(280 60% 55% / 0.7)',
];

export function TeamAIUsageChart({
  users,
  userUsageData,
  dailyUsageData,
  monthlyAiAllowance,
  isBusiness,
  planType,
  isLoadingDaily,
  onModeChange,
}: TeamAIUsageChartProps) {
  const [mode, setMode] = useState<ChartMode>('monthly');
  const isFree = planType === 'FREE';
  const formatValue = (v: number) => (isFree ? `${v}` : `$${v.toFixed(2)}`);

  const handleModeChange = (newMode: ChartMode) => {
    setMode(newMode);
    onModeChange(newMode);
  };

  const monthlyBars = useMemo(() => {
    if (!userUsageData) return [];
    return users.map((user): MonthlyBarData => {
      const usage = userUsageData.users.find((u) => u.userId === user.id);
      const label = user.name ?? user.email;
      if (!usage) return { user, included: 0, overage: 0, total: 0, label };

      if (isFree) {
        const used = usage.currentPeriodUsage ?? 0;
        const limit = usage.billingLimit ?? 0;
        const included = Math.min(used, limit);
        return { user, included, overage: 0, total: included, label };
      }

      const cost = usage.currentMonthAiCost ?? 0;
      const allowance = monthlyAiAllowance ?? 0;
      const included = Math.min(cost, allowance);
      const overage = isBusiness ? (usage.billedOverageCost ?? 0) : 0;
      return { user, included, overage, total: included + overage, label };
    });
  }, [users, userUsageData, monthlyAiAllowance, isBusiness, isFree]);

  const dailyBars = useMemo((): DailyBarData[] => {
    if (!dailyUsageData) return [];
    const byDate = new Map<string, DailyBarData>();

    for (const row of dailyUsageData.dailyCosts) {
      const user = users.find((u) => u.id === row.userId);
      if (!byDate.has(row.date)) {
        const d = new Date(row.date + 'T00:00:00');
        byDate.set(row.date, {
          date: row.date,
          dateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          segments: [],
          total: 0,
        });
      }
      const entry = byDate.get(row.date)!;
      entry.segments.push({
        userId: row.userId,
        userName: user?.name ?? user?.email ?? `User ${row.userId}`,
        value: row.value,
        billedOverageCost: row.billedOverageCost,
      });
      entry.total += row.value;
    }

    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyUsageData, users]);

  const monthlyMaxValue = useMemo(() => {
    if (monthlyBars.length === 0) return 0;
    const maxTotal = Math.max(...monthlyBars.map((b) => b.total));
    if (isFree) {
      const limit = userUsageData?.users[0]?.billingLimit ?? 0;
      return Math.max(maxTotal, limit);
    }
    return Math.max(maxTotal, monthlyAiAllowance ?? 0);
  }, [monthlyBars, isFree, userUsageData, monthlyAiAllowance]);

  const dailyMaxValue = useMemo(() => {
    if (dailyBars.length === 0) return 0;
    return Math.max(...dailyBars.map((b) => b.total));
  }, [dailyBars]);

  const maxValue = mode === 'monthly' ? monthlyMaxValue : dailyMaxValue;

  const { ticks, chartMax } = useMemo(() => {
    if (maxValue === 0) return { ticks: [0], chartMax: 1 };
    const tickCount = 4;
    const niceStep = getNiceStep(maxValue / tickCount);
    const result: number[] = [];
    for (let v = 0; v <= maxValue + niceStep * 0.5; v += niceStep) {
      result.push(Math.round(v * 100) / 100);
      if (result.length > tickCount + 1) break;
    }
    return { ticks: result, chartMax: result[result.length - 1] || 1 };
  }, [maxValue]);

  const hasAnyData = mode === 'monthly' ? monthlyBars.length > 0 && monthlyMaxValue > 0 : dailyBars.length > 0;

  const userColorMap = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((u, i) => map.set(u.id, USER_COLORS[i % USER_COLORS.length]));
    return map;
  }, [users]);

  return (
    <div className="space-y-2">
      {/* Header: mode toggle */}
      <div className="flex items-center justify-end">
        <div className="flex rounded-md border border-border text-xs">
          <button
            className={`px-2.5 py-1 transition-colors ${mode === 'daily' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => handleModeChange('daily')}
          >
            Daily
          </button>
          <button
            className={`px-2.5 py-1 transition-colors ${mode === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => handleModeChange('monthly')}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Chart */}
      {mode === 'daily' && isLoadingDaily ? (
        <div
          className="flex items-center justify-center text-sm text-muted-foreground"
          style={{ height: CHART_HEIGHT }}
        >
          Loading daily data…
        </div>
      ) : !hasAnyData ? (
        <div
          className="flex items-center justify-center text-sm text-muted-foreground"
          style={{ height: CHART_HEIGHT }}
        >
          No usage data
        </div>
      ) : (
        <div className="flex" style={{ height: CHART_HEIGHT }}>
          {/* Y-axis */}
          <div className="relative flex-shrink-0" style={{ width: 52, height: BAR_AREA_HEIGHT }}>
            {ticks.map((tick, i) => (
              <span
                key={i}
                className="absolute right-1 -translate-y-1/2 text-[10px] leading-none text-muted-foreground"
                style={{ bottom: (tick / chartMax) * BAR_AREA_HEIGHT }}
              >
                {formatValue(tick)}
              </span>
            ))}
          </div>

          {/* Bars area */}
          <div className="relative flex-1" style={{ height: CHART_HEIGHT }}>
            {ticks.map((tick, i) => (
              <div
                key={i}
                className="pointer-events-none absolute left-0 right-0 border-t border-border/50"
                style={{ bottom: (tick / chartMax) * BAR_AREA_HEIGHT + LABEL_AREA_HEIGHT }}
              />
            ))}

            <div className="flex h-full items-end justify-around">
              {mode === 'monthly'
                ? monthlyBars.map((bar) => (
                    <MonthlyBar
                      key={bar.user.id}
                      bar={bar}
                      chartMax={chartMax}
                      isFree={isFree}
                      isBusiness={isBusiness}
                      formatValue={formatValue}
                    />
                  ))
                : dailyBars.map((dayData) => (
                    <DailyBar
                      key={dayData.date}
                      dayData={dayData}
                      chartMax={chartMax}
                      isFree={isFree}
                      isBusiness={isBusiness}
                      formatValue={formatValue}
                      userColorMap={userColorMap}
                    />
                  ))}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-xs text-muted-foreground">
        {mode === 'monthly' ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-primary/70" />
              <span>{isFree ? 'Messages used' : 'Included usage'}</span>
            </div>
            {isBusiness && (
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-orange-500/80" />
                <span>On-demand usage</span>
              </div>
            )}
          </>
        ) : (
          users.map((user, i) => (
            <div key={user.id} className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: USER_COLORS[i % USER_COLORS.length] }}
              />
              <span>{user.name ?? user.email}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MonthlyBar({
  bar,
  chartMax,
  isFree,
  isBusiness,
  formatValue,
}: {
  bar: MonthlyBarData;
  chartMax: number;
  isFree: boolean;
  isBusiness: boolean;
  formatValue: (v: number) => string;
}) {
  const includedPx = chartMax > 0 ? (bar.included / chartMax) * BAR_AREA_HEIGHT : 0;
  const overagePx = chartMax > 0 ? (bar.overage / chartMax) * BAR_AREA_HEIGHT : 0;
  const firstName = bar.label.split(/[\s@]/)[0];
  const displayName = firstName.length > 10 ? firstName.slice(0, 9) + '\u2026' : firstName;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex flex-col items-center justify-end"
            style={{ flex: '1 1 0', maxWidth: 64, height: '100%' }}
          >
            {overagePx > 0 && (
              <div
                className="rounded-t bg-orange-500/80 transition-all duration-300"
                style={{ width: '50%', height: overagePx, minHeight: 2 }}
              />
            )}
            {includedPx > 0 && (
              <div
                className="bg-primary/70 transition-all duration-300"
                style={{
                  width: '50%',
                  height: includedPx,
                  minHeight: 2,
                  borderRadius: overagePx > 0 ? '0' : '4px 4px 0 0',
                }}
              />
            )}
            <div
              className="flex flex-col items-center gap-0.5 pt-1"
              style={{ height: LABEL_AREA_HEIGHT, flexShrink: 0 }}
            >
              <Avatar src={bar.user.picture} size="small">
                {bar.label}
              </Avatar>
              <span className="max-w-full truncate text-[10px] leading-tight text-muted-foreground">{displayName}</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p className="font-medium">{bar.label}</p>
            <p>
              {isFree ? 'Messages used' : 'Included'}: {formatValue(bar.included)}
            </p>
            {isBusiness && bar.overage > 0 && <p>On-demand: {formatValue(bar.overage)}</p>}
            <p className="font-medium">Total: {formatValue(bar.total)}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DailyBar({
  dayData,
  chartMax,
  isFree,
  isBusiness,
  formatValue,
  userColorMap,
}: {
  dayData: DailyBarData;
  chartMax: number;
  isFree: boolean;
  isBusiness: boolean;
  formatValue: (v: number) => string;
  userColorMap: Map<number, string>;
}) {
  const totalPx = chartMax > 0 ? (dayData.total / chartMax) * BAR_AREA_HEIGHT : 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex flex-col items-center justify-end"
            style={{ flex: '1 1 0', maxWidth: 48, height: '100%' }}
          >
            {totalPx > 0 && (
              <div className="flex flex-col items-center justify-end" style={{ width: '70%', height: totalPx }}>
                {dayData.segments
                  .map((seg) => {
                    const segPx = chartMax > 0 ? (seg.value / chartMax) * BAR_AREA_HEIGHT : 0;
                    const isLast = seg === dayData.segments[dayData.segments.length - 1];
                    return (
                      <div
                        key={seg.userId}
                        className="w-full transition-all duration-300"
                        style={{
                          height: segPx,
                          minHeight: segPx > 0 ? 2 : 0,
                          backgroundColor: userColorMap.get(seg.userId) ?? 'hsl(221 83% 53% / 0.7)',
                          borderRadius: isLast ? '4px 4px 0 0' : '0',
                        }}
                      />
                    );
                  })
                  .reverse()}
              </div>
            )}
            <div className="flex flex-col items-center pt-1" style={{ height: LABEL_AREA_HEIGHT, flexShrink: 0 }}>
              <span className="max-w-full truncate text-[10px] leading-tight text-muted-foreground">
                {dayData.dateLabel}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p className="font-medium">{dayData.dateLabel}</p>
            {dayData.segments.map((seg) => (
              <div key={seg.userId}>
                <p>
                  {seg.userName}: {formatValue(seg.value)}
                  {isBusiness && seg.billedOverageCost > 0 && (
                    <span className="text-orange-500"> (on-demand: {formatValue(seg.billedOverageCost)})</span>
                  )}
                </p>
              </div>
            ))}
            <p className="font-medium">Total: {formatValue(dayData.total)}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getNiceStep(rawStep: number): number {
  if (rawStep <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}
