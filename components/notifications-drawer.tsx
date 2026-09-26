'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Sparkles, AlertTriangle, Clock, Lightbulb, Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AINotification {
  id: string;
  type: 'recommendation' | 'reminder' | 'pattern';
  title: string;
  message: string;
  timestamp: string;
  read?: boolean;
}

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

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: AINotification['type']) => {
    switch (type) {
      case 'recommendation':
        return <Lightbulb className="h-4 w-4 text-emerald-500" />;
      case 'reminder':
        return <Clock className="h-4 w-4 text-sky-500" />;
      case 'pattern':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Sparkles className="h-4 w-4 text-primary" />;
    }
  };

  const markAllRead = () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    if (onMarkAllRead) onMarkAllRead();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative rounded-full h-9 w-9 border-primary/20 hover:border-primary/50 transition-all"
          aria-label="AI Notifications & Insights"
        >
          <Bell className="h-4 w-4 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 sm:w-96 p-0 shadow-xl border-2 border-primary/20 rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm">AI Notifications & Insights</h3>
          </div>
          {notifications.length > 0 && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-[11px] px-2">
                <Check className="h-3 w-3 mr-1" /> Mark read
              </Button>
            </div>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-border/40">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              No new AI notifications at this time.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'p-3 rounded-xl transition-all my-1 text-xs space-y-1',
                  n.read ? 'bg-background/60 opacity-80' : 'bg-primary/5 border border-primary/20 font-medium'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    {getIcon(n.type)}
                    <span>{n.title}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{n.timestamp}</span>
                </div>
                <p className="text-muted-foreground leading-relaxed pl-5">{n.message}</p>
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-2 border-t border-border/50 text-center bg-muted/20">
            <span className="text-[11px] text-muted-foreground">
              AI recommendations update live as you log meals.
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
