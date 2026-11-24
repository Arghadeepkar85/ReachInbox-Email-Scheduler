import React from 'react';
import { EmailJob } from '../types';
import { Search, Filter, RefreshCw, Star, Clock, ExternalLink } from 'lucide-react';

interface EmailListViewProps {
  activeTab: 'scheduled' | 'sent';
  emails: EmailJob[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onSelectEmail: (email: EmailJob) => void;
}

export const EmailListView: React.FC<EmailListViewProps> = ({
  activeTab,
  emails,
  loading,
  searchQuery,
  onSearchChange,
  onRefresh,
  isRefreshing,
  onSelectEmail,
}) => {
  const formatScheduledTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    return `${day} ${time}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
      {/* Top Search Bar & Action Toolbar matching Figma */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between space-x-4">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search"
            className="w-full bg-[#F4F6F8] border border-transparent rounded-full pl-10 pr-4 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
          />
        </div>

        {/* Action Icons matching Figma: Filter and Refresh */}
        <div className="flex items-center space-x-3 text-gray-400 pr-2">
          <button className="hover:text-gray-700 transition" title="Filter">
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={onRefresh}
            className={`hover:text-gray-700 transition ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`}
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Email List Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center space-x-4 py-2">
                <div className="w-24 h-4 bg-gray-100 rounded"></div>
                <div className="w-28 h-6 bg-gray-100 rounded-full"></div>
                <div className="flex-1 h-4 bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <p className="text-sm font-medium">No {activeTab} emails found</p>
            <p className="text-xs text-gray-400 mt-1">
              {activeTab === 'scheduled'
                ? 'Click Compose to schedule a new cold outreach campaign.'
                : 'Processed emails will appear here.'}
            </p>
          </div>
        ) : (
          emails.map((job) => {
            const isScheduledTab = activeTab === 'scheduled';
            return (
              <div
                key={job.id}
                onClick={() => onSelectEmail(job)}
                className="group flex items-center justify-between px-6 py-3.5 hover:bg-gray-50/80 transition cursor-pointer text-xs"
              >
                {/* Left Section: Recipient + Badge + Subject + Body Snippet */}
                <div className="flex items-center space-x-3 min-w-0 flex-1 pr-4">
                  {/* Recipient */}
                  <span className="font-bold text-gray-900 shrink-0 min-w-[120px] truncate">
                    To: {job.recipient.split('@')[0]}
                  </span>

                  {/* Badge matching Figma */}
                  {isScheduledTab ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] shrink-0">
                      <Clock className="w-3 h-3 text-[#D97706]" />
                      <span>{formatScheduledTime(job.scheduledAt)}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 shrink-0">
                      Sent
                    </span>
                  )}

                  {/* Subject & Preview Text snippet */}
                  <div className="flex items-center space-x-1.5 min-w-0 truncate">
                    <span className="font-bold text-gray-900 shrink-0 truncate max-w-[220px]">
                      {job.subject}
                    </span>
                    <span className="text-gray-400 truncate text-[11px]">
                      - {job.body.replace(/<[^>]+>/g, '').slice(0, 80)}...
                    </span>
                  </div>
                </div>

                {/* Right Actions: Ethereal preview button if sent + Star icon */}
                <div className="flex items-center space-x-3 shrink-0">
                  {job.etherealPreviewUrl && (
                    <a
                      href={job.etherealPreviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-2 py-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded flex items-center space-x-1 transition"
                      title="Open Live Ethereal Preview"
                    >
                      <span>Preview</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="text-gray-300 hover:text-amber-400 transition"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
