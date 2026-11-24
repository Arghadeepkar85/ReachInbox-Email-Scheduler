import React, { useState, useRef } from 'react';
import { emailApi } from '../services/api';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Upload,
  Calendar,
  X,
  Undo2,
  Redo2,
  Type,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  List,
  Indent,
  Outdent,
  Quote,
  Code,
  Strikethrough,
  ChevronDown
} from 'lucide-react';

interface ComposeViewProps {
  onBack: () => void;
  onScheduledSuccess: () => void;
}

export const ComposeView: React.FC<ComposeViewProps> = ({ onBack, onScheduledSuccess }) => {
  const [sender, setSender] = useState('oliver.brown@domain.io');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delaySec, setDelaySec] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);

  // Send Later Popover state
  const [isSendLaterOpen, setIsSendLaterOpen] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      const res = await emailApi.uploadLeads(file);
      setRecipients(res.emails);
    } catch (err: any) {
      setError('Failed to parse uploaded CSV/TXT list.');
    }
  };

  const handleAddRecipient = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = recipientInput.trim().toLowerCase();
      if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && !recipients.includes(trimmed)) {
        setRecipients([...recipients, trimmed]);
        setRecipientInput('');
      }
    }
  };

  const handleRemoveRecipient = (emailToRemove: string) => {
    setRecipients(recipients.filter((r) => r !== emailToRemove));
  };

  const handlePresetSelect = (hoursAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Tomorrow
    d.setHours(hoursAhead, 0, 0, 0);
    // Format to YYYY-MM-DDTHH:mm
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setScheduledDateTime(iso);
  };

  const handleSubmit = async (isSendNow = false) => {
    setError(null);

    let finalRecipients = [...recipients];
    if (recipientInput.trim()) {
      const trimmed = recipientInput.trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && !finalRecipients.includes(trimmed)) {
        finalRecipients.push(trimmed);
      }
    }

    if (finalRecipients.length === 0) {
      setError('Please add at least one recipient email address or upload a CSV lead list.');
      return;
    }

    if (!subject.trim()) {
      setError('Subject cannot be empty.');
      return;
    }

    setLoading(true);
    try {
      const startTime = isSendNow
        ? new Date().toISOString()
        : scheduledDateTime
        ? new Date(scheduledDateTime).toISOString()
        : new Date().toISOString();

      await emailApi.scheduleEmails({
        sender,
        recipients: finalRecipients,
        subject,
        body: body || 'Hello,\n\nFollowing up on our outreach.',
        startTime,
        delayMs: delaySec * 1000,
        hourlyLimit,
      });

      onScheduledSuccess();
      onBack();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to dispatch email campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0 relative">
      {/* Top Header matching Figma */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-gray-900">Compose New Email</h2>
        </div>

        {/* Top Right Action Buttons matching Figma */}
        <div className="flex items-center space-x-3">
          {/* Attachment Icon */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1 text-gray-400 hover:text-gray-700 p-1.5 rounded-lg transition"
            title="Upload CSV / File"
          >
            <Paperclip className="w-4 h-4" />
            {recipients.length > 0 && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                {recipients.length}
              </span>
            )}
          </button>

          {/* Clock Icon (Toggle Send Later) */}
          <button
            onClick={() => setIsSendLaterOpen(!isSendLaterOpen)}
            className={`p-1.5 rounded-lg transition ${
              isSendLaterOpen || scheduledDateTime
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-gray-400 hover:text-gray-700'
            }`}
            title="Schedule Delivery"
          >
            <Clock className="w-4 h-4" />
          </button>

          {/* Send / Send Later CTA Pill Button */}
          {scheduledDateTime ? (
            <button
              onClick={() => handleSubmit(false)}
              disabled={loading}
              className="py-1.5 px-5 rounded-full border border-[#00A859] text-[#00A859] hover:bg-[#E8F5E9] font-medium text-xs transition shadow-sm disabled:opacity-50"
            >
              {loading ? 'Scheduling...' : 'Send Later'}
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(true)}
              disabled={loading}
              className="py-1.5 px-5 rounded-full border border-[#00A859] text-[#00A859] hover:bg-[#E8F5E9] font-medium text-xs transition shadow-sm disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send'}
            </button>
          )}
        </div>
      </div>

      {/* Floating "Send Later" Popover matching Image 5 */}
      {isSendLaterOpen && (
        <div className="absolute top-16 right-6 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl p-5 z-50 text-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <span className="font-bold text-gray-900 text-sm">Send Later</span>
            <button
              onClick={() => setIsSendLaterOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-[11px] text-gray-400 mb-1">Pick date & time</label>
            <div className="relative">
              <input
                type="datetime-local"
                value={scheduledDateTime}
                onChange={(e) => setScheduledDateTime(e.target.value)}
                className="w-full bg-[#F4F6F8] border border-transparent rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Quick Presets matching Figma */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => handlePresetSelect(9)}
              className="w-full text-left py-1 text-gray-600 hover:text-emerald-700 transition"
            >
              Tomorrow, 9:00 AM
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect(10)}
              className="w-full text-left py-1 text-gray-600 hover:text-emerald-700 transition"
            >
              Tomorrow, 10:00 AM
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect(11)}
              className="w-full text-left py-1 text-gray-600 hover:text-emerald-700 transition"
            >
              Tomorrow, 11:00 AM
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect(15)}
              className="w-full text-left py-1 text-gray-600 hover:text-emerald-700 transition"
            >
              Tomorrow, 3:00 PM
            </button>
          </div>

          {/* Popover Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setScheduledDateTime('');
                setIsSendLaterOpen(false);
              }}
              className="text-gray-500 hover:text-gray-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setIsSendLaterOpen(false)}
              className="py-1 px-4 rounded-full border border-[#00A859] text-[#00A859] hover:bg-emerald-50 font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Main Compose Form Fields matching Figma */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {/* Hidden File Input for CSV lead upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* From Field matching Figma */}
        <div className="flex items-center space-x-4">
          <span className="w-14 text-xs text-gray-400 font-medium">From</span>
          <div className="relative">
            <select
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="appearance-none bg-[#F4F6F8] hover:bg-gray-200/80 transition rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-gray-800 cursor-pointer focus:outline-none"
            >
              <option value="oliver.brown@domain.io">oliver.brown@domain.io</option>
              <option value="outreach@reachinbox.ai">outreach@reachinbox.ai</option>
              <option value="sales@reachinbox.ai">sales@reachinbox.ai</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* To Field with Recipient Pills & Upload List matching Image 6 & 7 */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-4 flex-1 min-w-0 pr-4">
            <span className="w-14 text-xs text-gray-400 font-medium shrink-0">To</span>

            {/* Recipient Pills list */}
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
              {recipients.slice(0, 3).map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#00A859] border border-[#C8E6C9]"
                >
                  <span>{r}</span>
                  <button
                    onClick={() => handleRemoveRecipient(r)}
                    className="hover:text-rose-600 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {/* Extra count pill matching Image 7 "+4" */}
              {recipients.length > 3 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                  +{recipients.length - 3}
                </span>
              )}

              {/* Recipient Input */}
              <input
                type="email"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={handleAddRecipient}
                placeholder={recipients.length === 0 ? 'recipient@example.com' : 'Add more...'}
                className="text-xs text-gray-800 placeholder-gray-400 focus:outline-none flex-1 min-w-[140px] py-1 bg-transparent"
              />
            </div>
          </div>

          {/* Upload List CTA matching Image 6 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 text-xs font-semibold text-[#00A859] hover:text-emerald-700 transition shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload List</span>
          </button>
        </div>

        {/* Subject Field matching Figma */}
        <div className="flex items-center space-x-4 border-b border-gray-100 pb-3">
          <span className="w-14 text-xs text-gray-400 font-medium">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 text-xs text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
          />
        </div>

        {/* Delay & Hourly Limit Inputs matching Figma */}
        <div className="flex items-center space-x-8 pt-1">
          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-500 font-medium">Delay between 2 emails</span>
            <input
              type="number"
              min={1}
              value={delaySec}
              onChange={(e) => setDelaySec(parseInt(e.target.value, 10) || 2)}
              className="w-14 text-center py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-500 font-medium">Hourly Limit</span>
            <input
              type="number"
              min={1}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 200)}
              className="w-14 text-center py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Rich Body Card Container matching Figma */}
        <div className="bg-[#F8FAFC] border border-gray-100 rounded-2xl p-5 min-h-[360px] flex flex-col mt-4">
          {/* Rich Editor Toolbar matching Figma */}
          <div className="bg-white rounded-full px-4 py-2 shadow-sm border border-gray-100 flex items-center space-x-3 text-gray-500 text-xs mb-4 select-none">
            <button className="hover:text-gray-800"><Undo2 className="w-3.5 h-3.5" /></button>
            <button className="hover:text-gray-800"><Redo2 className="w-3.5 h-3.5" /></button>
            <div className="w-[1px] h-3 bg-gray-200" />
            <button className="hover:text-gray-800 flex items-center space-x-0.5 font-serif font-bold">
              <span>Tt</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
            <button className="hover:text-gray-800 font-bold">B</button>
            <button className="hover:text-gray-800 italic">I</button>
            <button className="hover:text-gray-800 underline">U</button>
            <div className="w-[1px] h-3 bg-gray-200" />
            <button className="hover:text-gray-800"><AlignLeft className="w-3.5 h-3.5" /></button>
            <button className="hover:text-gray-800"><List className="w-3.5 h-3.5" /></button>
            <button className="hover:text-gray-800"><Indent className="w-3.5 h-3.5" /></button>
            <button className="hover:text-gray-800"><Outdent className="w-3.5 h-3.5" /></button>
            <div className="w-[1px] h-3 bg-gray-200" />
            <button className="hover:text-gray-800"><Quote className="w-3.5 h-3.5" /></button>
            <button className="hover:text-gray-800"><Code className="w-3.5 h-3.5" /></button>
            <button className="hover:text-gray-800"><Strikethrough className="w-3.5 h-3.5" /></button>
          </div>

          {/* Email Body Textarea matching Figma */}
          <textarea
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type Your Reply..."
            className="w-full flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none resize-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
};
