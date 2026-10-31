'use client';

import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, Sparkles, AlertTriangle, Clock, Lightbulb, Check, HeartPulse, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AINotification } from '@/lib/notifications';
import { markNotificationAsRead, markAllNotificationsAsRead } from '@/lib/notifications';

export type { AINotification };

interface NotificationsDrawerProps {
  notifications: AINotification[];
  onClearAll?: () => void;
  onMarkAllRead?: () => void;
}

export function NotificationsDrawer({
  notifications = [],
  onClearAll,
  onMarkAllRead,
}: NotificationsDrawerProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AINotification[]>(notifications);

  useEffect(() => {
    setItems(notifications);
  }, [notifications]);

  const unreadCount = items.filter((n) => !n.read).length;

  const getIcon = (type: AINotification['type']) => {
    switch (type) {
      case 'recommendation':
        return <Lightbulb className="h-4 w-4 text-emerald-500" />;
      case 'reminder':
        return <Clock className="h-4 w-4 text-sky-500" />;
      case 'pattern':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'health_alert':
        return <HeartPulse className="h-4 w-4 text-rose-500" />;
      default:
        return <Sparkles className="h-4 w-4 text-primary" />;
    }
  };

  const markAllRead = () => {
    const ids = items.map((i) => i.id);
    markAllNotificationsAsRead(ids);
    setItems([]);
    if (onMarkAllRead) onMarkAllRead();
  };

  const markOneRead = (id: string) => {
    markNotificationAsRead(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (onMarkAllRead) onMarkAllRead();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative rounded-full h-9 w-9 border-primary/20 hover:border-primary/50 transition-all"
          aria-label="Notifications & Insights"
        >
          <Bell className="h-4 w-4 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[90vw] sm:w-96 max-w-[380px] p-0 shadow-xl border border-border/80 rounded-2xl overflow-hidden glass-card">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm">Notifications & Insights</h3>
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-[11px] px-2 hover:bg-primary/10">
                <Check className="h-3 w-3 mr-1" /> Mark as Read
              </Button>
            </div>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-border/40">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              No new notifications at this time.
            </div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className="p-3 rounded-xl transition-all my-1 text-xs space-y-1 bg-primary/5 border border-primary/20 font-medium group relative"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    {getIcon(n.type)}
                    <span>{n.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">{n.timestamp}</span>
                    <button
                      type="button"
                      onClick={() => markOneRead(n.id)}
                      title="Dismiss notification"
                      className="opacity-60 hover:opacity-100 hover:text-primary transition-opacity p-0.5 rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed pl-5">{n.message}</p>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-2 border-t border-border/50 text-center bg-muted/20">
            <span className="text-[11px] text-muted-foreground">
              Recommendations update live as you log meals.
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
