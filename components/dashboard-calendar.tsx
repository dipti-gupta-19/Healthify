'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, RotateCcw } from 'lucide-react';
import type { LoggedMeal } from '@/lib/nutrition';
import { cn } from '@/lib/utils';

interface DashboardCalendarProps {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  meals: LoggedMeal[];
  targetCalories?: number;
}

export function DashboardCalendar({
  selectedDate,
  onSelectDate,
  meals,
}: DashboardCalendarProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map meals by YYYY-MM-DD
  const mealsByDay: Record<string, { count: number; calories: number }> = {};
  meals.forEach((m) => {
    const dateObj = new Date(m.loggedAt);
    const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(
      dateObj.getDate()
    ).padStart(2, '0')}`;
    if (!mealsByDay[key]) mealsByDay[key] = { count: 0, calories: 0 };
    mealsByDay[key].count += 1;
    mealsByDay[key].calories += m.facts?.calories || 0;
  });

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const prevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    onSelectDate(d);
  };

  const nextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    onSelectDate(d);
  };

  const isToday = (d: number) => {
    const today = new Date();
    return d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const isSelected = (d: number) => {
    return (
      d === selectedDate.getDate() &&
      month === selectedDate.getMonth() &&
      year === selectedDate.getFullYear()
    );
  };

  const isSelectedToday = selectedDate.toDateString() === new Date().toDateString();

  const dateLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Grid cells for popover
  const dayCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    dayCells.push(<div key={`empty-${i}`} className="h-8 rounded-lg bg-muted/20" />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayData = mealsByDay[dateKey] || { count: 0, calories: 0 };
    const today = isToday(d);
    const selected = isSelected(d);
    const cellDate = new Date(year, month, d);

    dayCells.push(
      <button
        key={`day-${d}`}
        type="button"
        onClick={() => {
          onSelectDate(cellDate);
          setPopoverOpen(false);
        }}
        className={cn(
          'h-9 rounded-lg flex flex-col items-center justify-center text-xs transition-all relative font-medium',
          selected
            ? 'bg-primary text-primary-foreground font-bold shadow-md'
            : today
            ? 'border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
            : 'hover:bg-muted text-foreground'
        )}
      >
        <span>{d}</span>
        {dayData.count > 0 && (
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full mt-0.5',
              selected ? 'bg-white' : 'bg-emerald-500'
            )}
          />
        )}
      </button>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-primary/20 bg-card/90 shadow-sm glass-card">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={prevDay} className="h-8 w-8 rounded-lg">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Compact Popover Trigger */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 font-semibold text-xs border-primary/30 h-9 rounded-xl px-3 hover:border-primary"
            >
              <CalendarIcon className="h-4 w-4 text-primary" />
              <span>{dateLabel}</span>
              {isSelectedToday && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary font-bold">
                  Today
                </Badge>
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent align="center" className="w-72 p-3 shadow-xl border-2 border-primary/20 rounded-2xl">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-bold">{monthLabel}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted-foreground mb-1">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
            </div>

            <div className="grid grid-cols-7 gap-1">{dayCells}</div>

            <div className="mt-3 pt-2 border-t border-border flex justify-between items-center text-[11px]">
              <span className="text-muted-foreground">• Green dots = tasks logged</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSelectDate(new Date());
                  setPopoverOpen(false);
                }}
                className="text-xs font-semibold text-primary h-7 px-2"
              >
                Today
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="icon" onClick={nextDay} className="h-8 w-8 rounded-lg">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {!isSelectedToday && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelectDate(new Date())}
          className="text-xs font-medium text-primary gap-1.5 h-8 px-2.5"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset to Today
        </Button>
      )}
    </div>
  );
}
