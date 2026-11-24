import React from 'react';
import { EmailJob } from '../types';
import { Clock, Trash2, Calendar, AlertCircle } from 'lucide-react';

interface ScheduledTableProps {
  emails: EmailJob[];
  loading: boolean;
  onCancel: (id: string) => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({ emails, loading, onCancel }) => {
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
        <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center mb-3">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-gray-200">No scheduled emails in queue</h3>
        <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
          All your scheduled outreach emails will appear here before they are dispatched.
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
              <th scope="col" className="px-6 py-3.5">Scheduled Time</th>
              <th scope="col" className="px-6 py-3.5">Status</th>
              <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/80">
            {emails.map((job) => {
              const scheduledDate = new Date(job.scheduledAt);
              const isDelayed = job.status === 'DELAYED';

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

                  {/* Scheduled Time */}
                  <td className="px-6 py-4 text-gray-300 whitespace-nowrap">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      <span>{scheduledDate.toLocaleString()}</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isDelayed ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <AlertCircle className="w-3 h-3" />
                        <span>Throttled / Rescheduled</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                        Scheduled
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onCancel(job.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      title="Cancel Scheduled Email"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
