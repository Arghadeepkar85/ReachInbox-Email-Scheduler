import React, { useState, useRef } from 'react';
import { emailApi } from '../services/api';
import { X, Upload, CheckCircle2, FileText, Send, AlertCircle, Plus } from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [sender, setSender] = useState('outreach@reachinbox.ai');
  const [recipientsInput, setRecipientsInput] = useState('');
  const [recipientsList, setRecipientsList] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delaySec, setDelaySec] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);

  const [fileName, setFileName] = useState('');
  const [detectedCount, setDetectedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    try {
      const res = await emailApi.uploadLeads(file);
      setDetectedCount(res.count);
      setRecipientsList(res.emails);
      setRecipientsInput(res.emails.join(', '));
    } catch (err: any) {
      setError('Failed to parse uploaded leads file. Please ensure it is a valid CSV or TXT file.');
    }
  };

  const handleManualRecipientsChange = (val: string) => {
    setRecipientsInput(val);
    const emails = val
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const unique = Array.from(new Set(emails));
    setRecipientsList(unique);
    setDetectedCount(unique.length);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (recipientsList.length === 0) {
      setError('Please add at least one recipient email address or upload a CSV.');
      return;
    }

    if (!subject.trim() || !body.trim()) {
      setError('Subject and Body cannot be empty.');
      return;
    }

    setLoading(true);
    try {
      await emailApi.scheduleEmails({
        sender,
        recipients: recipientsList,
        subject,
        body,
        startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        delayMs: delaySec * 1000,
        hourlyLimit,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to schedule campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#0E1322]">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Compose & Schedule Campaign</h2>
              <p className="text-xs text-gray-400">Configure parameters, recipients, and throttling limits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender Email */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Sender Identity (Multi-Sender Support)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                className="w-full bg-[#0B0F19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="outreach@reachinbox.ai">outreach@reachinbox.ai (Primary)</option>
                <option value="sales@reachinbox.ai">sales@reachinbox.ai</option>
                <option value="growth@reachinbox.ai">growth@reachinbox.ai</option>
                <option value="custom">Custom sender address...</option>
              </select>
              {sender === 'custom' && (
                <input
                  type="email"
                  placeholder="custom-sender@domain.com"
                  onChange={(e) => setSender(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              )}
            </div>
          </div>

          {/* CSV File Upload for Leads */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Upload Lead List (CSV / TXT)
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-700 hover:border-indigo-500/60 rounded-xl p-4 text-center cursor-pointer bg-[#0B0F19]/60 hover:bg-[#0B0F19] transition group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center space-y-1">
                <Upload className="w-6 h-6 text-gray-400 group-hover:text-indigo-400 transition" />
                <p className="text-xs text-gray-300">
                  {fileName ? (
                    <span className="font-semibold text-indigo-400 flex items-center justify-center space-x-1">
                      <FileText className="w-3.5 h-3.5 mr-1" /> {fileName}
                    </span>
                  ) : (
                    <span>Click to browse CSV or text file containing lead emails</span>
                  )}
                </p>
                <p className="text-[11px] text-gray-500">Auto-detects emails from any CSV column format</p>
              </div>
            </div>

            {detectedCount !== null && (
              <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-semibold">
                    {detectedCount} recipient{detectedCount === 1 ? '' : 's'} detected & loaded
                  </span>
                </div>
                <span className="text-[10px] text-emerald-500/80">Ready to schedule</span>
              </div>
            )}
          </div>

          {/* Manual Recipients Input */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Recipients (Comma or line separated)
            </label>
            <textarea
              rows={2}
              value={recipientsInput}
              onChange={(e) => handleManualRecipientsChange(e.target.value)}
              placeholder="lead1@target.com, lead2@company.org, lead3@domain.io"
              className="w-full bg-[#0B0F19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Subject Line */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Subject Line *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Scaling your outreach infrastructure with ReachInbox"
              className="w-full bg-[#0B0F19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Email Body (HTML or Plain Text) *
            </label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi there,<br><br>We loved your product and would love to connect..."
              className="w-full bg-[#0B0F19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 font-sans"
              required
            />
          </div>

          {/* Scheduling & Throttling Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-800">
            {/* Start Time */}
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-[#0B0F19] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-gray-500">Leave blank to start immediately</span>
            </div>

            {/* Delay Between Sends */}
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">
                Delay Between Sends
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={delaySec}
                  onChange={(e) => setDelaySec(parseInt(e.target.value, 10) || 2)}
                  className="w-full bg-[#0B0F19] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-gray-400">sec</span>
              </div>
              <span className="text-[10px] text-gray-500">Min 2s to mimic provider limits</span>
            </div>

            {/* Hourly Rate Limit */}
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">
                Hourly Limit / Sender
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 200)}
                  className="w-full bg-[#0B0F19] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-gray-400">/hr</span>
              </div>
              <span className="text-[10px] text-gray-500">Auto-postpones on limit hit</span>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Enqueuing Jobs...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Schedule Campaign</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
