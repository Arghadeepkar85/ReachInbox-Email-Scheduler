import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Activity, MessageSquare, MailCheck } from 'lucide-react';

interface NavbarProps {
  onOpenSlackModal: () => void;
  isSlackConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSlackModal, isSlackConnected }) => {
  const { user, logout } = useAuth();
  const [avatarError, setAvatarError] = React.useState(false);

  // Reset avatar error state if user changes
  React.useEffect(() => {
    setAvatarError(false);
  }, [user?.avatar]);

  return (
    <header className="border-b border-gray-800 bg-[#0E1322] sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <MailCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">ReachInbox</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Scheduler
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center space-x-3">
            {/* BullMQ Dashboard Link */}
            <a
              href="http://localhost:5000/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-gray-800/80 hover:bg-gray-800 hover:text-white border border-gray-700 transition shadow-sm"
              title="Live BullMQ Queue Visualizer"
            >
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              <span>BullMQ Board</span>
            </a>

            {/* Connect Slack Button */}
            <button
              onClick={onOpenSlackModal}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm border ${
                isSlackConnected
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-[#4A154B]/30 text-[#ECB22E] border-[#4A154B] hover:bg-[#4A154B]/50'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{isSlackConnected ? 'Slack Connected' : 'Connect Slack'}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isSlackConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
            </button>

            {/* User Profile Header */}
            {user && (
              <div className="flex items-center pl-3 border-l border-gray-800 space-x-3">
                {/* User Avatar with Google no-referrer and clean fallback badge */}
                {!avatarError && user.avatar ? (
                  <img
                    referrerPolicy="no-referrer"
                    src={user.avatar}
                    alt={user.name || user.email}
                    onError={() => setAvatarError(true)}
                    className="w-8 h-8 rounded-full border border-gray-700 object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold border border-indigo-400/30 shadow-sm shrink-0">
                    {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:block text-left text-xs">
                  <p className="font-semibold text-gray-200 truncate max-w-[120px]">
                    {user.name || 'User'}
                  </p>
                  <p className="text-gray-400 text-[11px] truncate max-w-[140px]">{user.email}</p>
                </div>

                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
