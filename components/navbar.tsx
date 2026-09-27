'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProfile } from '@/components/profile-context';
import { AuthModal } from '@/components/auth-modal';
import { NotificationsDrawer, type AINotification } from '@/components/notifications-drawer';
import { Leaf, Camera, ClipboardList, LayoutDashboard, UserCircle, Menu, LogIn, LogOut, User, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { generateLiveNotifications } from '@/lib/notifications';
import { readLocalMeals } from '@/lib/meal-history';

const links = [
  { href: '/', label: 'Home', icon: Leaf },
  { href: '/scan/packaged', label: 'Packaged', icon: ClipboardList },
  { href: '/scan/unpackaged', label: 'Unpackaged', icon: Camera },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/profile', label: 'Profile', icon: UserCircle },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, profile, targets, authModalOpen, setAuthModalOpen, loginUser, logoutUser } = useProfile();
  const [open, setOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'login' | 'register'>('login');
  const [notifications, setNotifications] = useState<AINotification[]>([]);

  const openLogin = () => {
    setModalTab('login');
    setAuthModalOpen(true);
  };

  const openRegister = () => {
    setModalTab('register');
    setAuthModalOpen(true);
  };

  useEffect(() => {
    const meals = readLocalMeals();
    const live = generateLiveNotifications(meals, targets, profile);
    setNotifications(live);
  }, [profile, targets, pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md transition-all">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-xl text-primary group">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 transition-transform group-hover:scale-105">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="tracking-tight text-foreground group-hover:text-primary transition-colors">
            Healthify
          </span>
        </Link>

        <div className="hidden items-center gap-1.5 md:flex">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
                  active
                    ? 'bg-primary/10 text-primary font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                )}
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {/* AI Notifications Drawer Widget */}
          <NotificationsDrawer notifications={notifications} />

          {user || profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-full border-primary/30 px-4 h-10 shadow-xs hover:border-primary">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-xs">
                    {(user?.name || profile?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold text-sm">{user?.name || profile?.name || 'User'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-xl p-2 shadow-xl border-2 border-primary/20">
                <DropdownMenuLabel className="font-normal px-3 py-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold leading-none">{user?.name || profile?.name || 'User'}</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">{user?.email || 'MongoDB Synced'}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer flex items-center gap-2 text-sm font-semibold p-2">
                    <User className="h-4 w-4 text-primary" /> Profile Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="cursor-pointer flex items-center gap-2 text-sm font-semibold p-2">
                    <LayoutDashboard className="h-4 w-4 text-primary" /> Health Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logoutUser} className="cursor-pointer text-destructive focus:text-destructive flex items-center gap-2 text-sm font-semibold p-2">
                  <LogOut className="h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={openLogin} className="gap-1.5 text-sm font-bold h-10 px-4">
                <LogIn className="h-4 w-4" /> Sign In
              </Button>
              <Button size="sm" onClick={openRegister} className="gap-1.5 text-sm font-bold rounded-xl h-10 px-5 shadow-xs">
                Register
              </Button>
            </div>
          )}
        </div>

        {/* Mobile menu trigger */}
        <div className="flex items-center gap-2 md:hidden">
          <NotificationsDrawer notifications={notifications} />
          <button
            className="rounded-xl p-2.5 text-foreground hover:bg-muted border border-border"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {open && (
        <div className="md:hidden border-t border-border/80 bg-background/95 backdrop-blur-lg animate-slide-up">
          <div className="flex flex-col gap-1 px-4 py-4">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors',
                    active
                      ? 'bg-primary/10 text-primary font-extrabold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  <l.icon className="h-5 w-5" />
                  {l.label}
                </Link>
              );
            })}
            <div className="pt-4 border-t border-border/60 mt-2">
              {user || profile ? (
                <Button variant="outline" onClick={logoutUser} className="w-full justify-start gap-2 text-destructive text-sm font-bold h-11">
                  <LogOut className="h-4 w-4" /> Sign Out ({user?.name || profile?.name})
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" size="sm" onClick={openLogin} className="text-sm font-bold h-11">Sign In</Button>
                  <Button size="sm" onClick={openRegister} className="text-sm font-bold h-11">Register</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onSuccess={loginUser}
        defaultTab={modalTab}
      />
    </header>
  );
}
