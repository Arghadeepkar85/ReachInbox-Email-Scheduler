import React from 'react';
import { EmailJob } from '../types';
import { Send, ExternalLink, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface SentTableProps {
  emails: EmailJob[];
  loading: boolean;
}

export const SentTable: React.FC<SentTableProps> = ({ emails, loading }) => {
  if (loading) {
    return (
      <div className="bg-[#111827] rounded-xl border border-gray-800 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-800 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-800/60 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-[#111827] rounded-xl border border-gray-800 p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center mb-3">
          <Send className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-gray-200">No sent emails yet</h3>
        <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
          Delivered emails with Ethereal SMTP test links will be listed here after being processed.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-800 text-left text-xs">
          <thead className="bg-[#0B0F19]/60 text-gray-400 uppercase tracking-wider font-medium">
            <tr>
              <th scope="col" className="px-6 py-3.5">Recipient</th>
              <th scope="col" className="px-6 py-3.5">Subject</th>
              <th scope="col" className="px-6 py-3.5">Sender</th>
              <th scope="col" className="px-6 py-3.5">Sent Time</th>
              <th scope="col" className="px-6 py-3.5">Status</th>
              <th scope="col" className="px-6 py-3.5 text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/80">
            {emails.map((job) => {
              const sentDate = job.sentAt ? new Date(job.sentAt) : new Date(job.updatedAt);
              const isSent = job.status === 'SENT';

              return (
                <tr key={job.id} className="hover:bg-gray-800/40 transition">
                  {/* Recipient */}
                  <td className="px-6 py-4 font-medium text-gray-200">
                    {job.recipient}
                  </td>

                  {/* Subject */}
                  <td className="px-6 py-4 text-gray-300 max-w-xs truncate" title={job.subject}>
                    {job.subject}
                  </td>

                  {/* Sender */}
                  <td className="px-6 py-4 text-gray-400">
                    <span className="font-mono text-[11px] bg-gray-800/80 px-2 py-0.5 rounded border border-gray-700/60">
                      {job.sender}
                    </span>
                  </td>

                  {/* Sent Time */}
                  <td className="px-6 py-4 text-gray-300 whitespace-nowrap">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      <span>{sentDate.toLocaleString()}</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isSent ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Sent</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Failed</span>
                      </span>
                    )}
                  </td>

                  {/* Ethereal Preview Link */}
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    {job.etherealPreviewUrl ? (
                      <a
                        href={job.etherealPreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition shadow-sm"
                      >
                        <span>View Email</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-gray-500 text-[11px]">No preview available</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
