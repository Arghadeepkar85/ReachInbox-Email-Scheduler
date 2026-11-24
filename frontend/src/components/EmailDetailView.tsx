import React from 'react';
import { EmailJob } from '../types';
import { ArrowLeft, Star, Archive, Trash2, ExternalLink, Clock, CheckCircle2 } from 'lucide-react';

interface EmailDetailViewProps {
  email: EmailJob;
  onBack: () => void;
  onCancel?: (id: string) => void;
}

export const EmailDetailView: React.FC<EmailDetailViewProps> = ({ email, onBack, onCancel }) => {
  const formattedDate = new Date(email.sentAt || email.scheduledAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
      {/* Top Header matching Figma */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-gray-900 truncate">
            {email.subject}
          </h2>
        </div>

        {/* Right Action Icons matching Figma */}
        <div className="flex items-center space-x-3 text-gray-400">
          <button className="hover:text-amber-400 transition" title="Star">
            <Star className="w-4 h-4" />
          </button>
          <button className="hover:text-gray-700 transition" title="Archive">
            <Archive className="w-4 h-4" />
          </button>
          {onCancel && email.status === 'SCHEDULED' && (
            <button
              onClick={() => {
                onCancel(email.id);
                onBack();
              }}
              className="hover:text-rose-600 transition"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Message Body matching Figma */}
      <div className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-6">
        {/* Sender & Metadata header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-[#00A859] text-white flex items-center justify-center font-bold text-sm shrink-0">
              {email.sender.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm text-gray-900">{email.sender}</span>
                <span className="text-xs text-gray-400">&lt;{email.sender}&gt;</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                to <span className="text-gray-600 font-medium">{email.recipient}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-gray-400">{formattedDate}</span>
            <div className="mt-1">
              {email.status === 'SENT' ? (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Delivered via Ethereal</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                  <Clock className="w-3 h-3" />
                  <span>Scheduled Delivery</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live Ethereal Preview Button */}
        {email.etherealPreviewUrl && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div className="text-xs text-emerald-800">
              <span className="font-semibold">Fake SMTP Delivery Active:</span> View the actual rendered email in Ethereal test inbox.
            </div>
            <a
              href={email.etherealPreviewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#00A859] hover:bg-[#00924d] transition shadow-sm"
            >
              <span>Open in Ethereal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Email HTML / Text Body Content */}
        <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed pt-2">
          <div dangerouslySetInnerHTML={{ __html: email.body }} />
        </div>
      </div>
    </div>
  );
};
