import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, Send, ChevronDown, LogOut, MessageSquare, Activity } from 'lucide-react';

interface SidebarProps {
  activeTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  onOpenSlack: () => void;
  isSlackConnected: boolean;
  scheduledCount: number;
  sentCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenCompose,
  onOpenSlack,
  isSlackConnected,
  scheduledCount,
  sentCount,
}) => {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  return (
    <aside className="w-64 border-r border-gray-100 bg-white flex flex-col h-screen sticky top-0 shrink-0 select-none p-5">
      {/* Top Brand Logo matching Figma "ONB" */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <span className="font-black text-2xl tracking-tighter text-black font-sans">
            ONB
          </span>
        </div>
      </div>

      {/* User Profile Card matching Figma */}
      <div className="relative mb-6">
        <div
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center justify-between p-2 rounded-xl bg-[#F4F6F8] hover:bg-gray-200/70 transition cursor-pointer"
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            {!avatarError && user?.avatar ? (
              <img
                referrerPolicy="no-referrer"
                src={user.avatar}
                alt={user.name || user.email}
                onError={() => setAvatarError(true)}
                className="w-8 h-8 rounded-full object-cover border border-gray-300 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#00A859] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {(user?.name || user?.email || 'O').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 text-left">
              <p className="text-xs font-bold text-gray-900 truncate">
                {user?.name || 'Oliver Brown'}
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                {user?.email || 'oliver.brown@domain.io'}
              </p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        </div>

        {/* Dropdown Menu for Logout & Links */}
        {showUserMenu && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg p-2 z-40 space-y-1">
            <button
              onClick={() => {
                setShowUserMenu(false);
                onOpenSlack();
              }}
              className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-gray-50 flex items-center justify-between text-gray-700"
            >
              <span className="flex items-center space-x-2">
                <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
                <span>Slack Alerts</span>
              </span>
              <span className={`w-2 h-2 rounded-full ${isSlackConnected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            </button>
            <a
              href="http://localhost:5000/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-gray-50 flex items-center space-x-2 text-gray-700"
            >
              <Activity className="w-3.5 h-3.5 text-gray-500" />
              <span>BullMQ Board</span>
            </a>
            <div className="border-t border-gray-100 my-1"></div>
            <button
              onClick={logout}
              className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-rose-50 text-rose-600 flex items-center space-x-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        )}
      </div>

      {/* Primary Compose Button matching Figma */}
      <button
        onClick={onOpenCompose}
        className="w-full py-2 px-4 rounded-full border border-[#00A859] text-[#00A859] hover:bg-[#E8F5E9] font-medium text-sm transition text-center mb-8 shadow-sm flex items-center justify-center space-x-2"
      >
        <span>Compose</span>
      </button>

      {/* CORE Navigation Section matching Figma */}
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">
          CORE
        </p>
        <div className="space-y-1">
          {/* Scheduled Nav Item */}
          <button
            onClick={() => onTabChange('scheduled')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition ${
              activeTab === 'scheduled'
                ? 'bg-[#E8F5E9] text-gray-900 font-bold'
                : 'text-gray-600 hover:bg-gray-50 font-medium'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Clock className="w-4 h-4 text-gray-500" />
              <span>Scheduled</span>
            </div>
            <span className="text-xs text-gray-400 font-normal">{scheduledCount}</span>
          </button>

          {/* Sent Nav Item */}
          <button
            onClick={() => onTabChange('sent')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition ${
              activeTab === 'sent'
                ? 'bg-[#E8F5E9] text-gray-900 font-bold'
                : 'text-gray-600 hover:bg-gray-50 font-medium'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Send className="w-4 h-4 text-gray-500" />
              <span>Sent</span>
            </div>
            <span className="text-xs text-gray-400 font-normal">{sentCount}</span>
          </button>
        </div>
      </div>

      {/* Bottom Footer Status info */}
      <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
        <button
          onClick={onOpenSlack}
          className="hover:text-emerald-700 flex items-center space-x-1"
        >
          <span className={`w-2 h-2 rounded-full ${isSlackConnected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <span>{isSlackConnected ? 'Slack Active' : 'Slack Setup'}</span>
        </button>
        <a
          href="http://localhost:5000/admin/queues"
          target="_blank"
          rel="noreferrer"
          className="hover:text-emerald-700"
        >
          BullMQ
        </a>
      </div>
    </aside>
  );
};
