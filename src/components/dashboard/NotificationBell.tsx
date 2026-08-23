import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useSettingsStore } from '@/stores/settingsStore';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

/** Netflix-style notification bell with badge counter */
export function NotificationBell() {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'New Mock Available',
      message: 'SSC CGL Tier 2 Full Length Test just added',
      time: '2 hours ago',
      read: false,
    },
    {
      id: '2',
      title: 'Your streak is at risk',
      message: "Complete today's goal to keep your 5-day streak",
      time: '1 day ago',
      read: false,
    },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          'relative w-8 h-8 grid place-items-center rounded-full transition-colors',
          isNetflix
            ? 'text-white hover:bg-white/10'
            : 'text-muted hover:text-text hover:bg-surface-2'
        )}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E50914] text-white text-[10px] font-bold rounded-full flex items-center justify-center"
          >
            {unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            className={clsx(
              'absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl shadow-xl border overflow-hidden z-50',
              isNetflix
                ? 'bg-[#181818] border-[#333]'
                : 'bg-bg-raised border-[var(--glass-border)]'
            )}
          >
            <div className={clsx(
              'flex items-center justify-between px-3 py-2 border-b',
              isNetflix ? 'border-[#333]' : 'border-[var(--glass-border)]'
            )}>
              <span className={clsx(
                'text-sm font-semibold',
                isNetflix ? 'text-white' : 'text-text'
              )}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className={clsx(
                    'text-xs font-medium',
                    isNetflix ? 'text-[#E50914]' : 'text-primary'
                  )}
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className={clsx(
                  'px-3 py-6 text-center text-sm',
                  isNetflix ? 'text-[#808080]' : 'text-muted'
                )}>
                  No notifications
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={clsx(
                      'relative px-3 py-2.5 border-b last:border-b-0 transition-colors hover:bg-primary-soft/50',
                      isNetflix ? 'border-[#333]' : 'border-[var(--glass-border)]'
                    )}
                  >
                    {!n.read && (
                      <span className={clsx(
                        'absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full',
                        isNetflix ? 'bg-[#E50914]' : 'bg-primary'
                      )} />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={clsx(
                          'text-sm font-medium truncate',
                          isNetflix ? 'text-white' : 'text-text'
                        )}>
                          {n.title}
                        </div>
                        <div className={clsx(
                          'text-xs mt-0.5 line-clamp-2',
                          isNetflix ? 'text-[#808080]' : 'text-muted'
                        )}>
                          {n.message}
                        </div>
                        <div className={clsx(
                          'text-xs mt-1',
                          isNetflix ? 'text-[#666]' : 'text-muted'
                        )}>
                          {n.time}
                        </div>
                      </div>
                      <button
                        onClick={() => removeNotification(n.id)}
                        className={clsx(
                          'p-1 rounded hover:bg-surface-2 transition-colors',
                          isNetflix ? 'text-[#666] hover:text-white' : 'text-muted'
                        )}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}