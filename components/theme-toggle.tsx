'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Moon, Sun, Monitor } from 'lucide-react';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`h-9 w-9 rounded-xl border border-border/60 ${className || ''}`}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-9 w-9 rounded-xl border border-border/60 hover:bg-muted text-foreground transition-all ${className || ''}`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Moon className="h-4 w-4 text-emerald-400 transition-transform hover:rotate-12" />
          ) : (
            <Sun className="h-4 w-4 text-amber-500 transition-transform hover:rotate-45" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl border border-border/80 shadow-lg p-1 min-w-[120px]">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="gap-2 text-xs font-semibold cursor-pointer rounded-lg"
        >
          <Sun className="h-4 w-4 text-amber-500" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="gap-2 text-xs font-semibold cursor-pointer rounded-lg"
        >
          <Moon className="h-4 w-4 text-emerald-400" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="gap-2 text-xs font-semibold cursor-pointer rounded-lg"
        >
          <Monitor className="h-4 w-4 text-muted-foreground" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
