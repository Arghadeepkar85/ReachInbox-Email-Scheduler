import React, { useState } from 'react';
import { slackApi } from '../services/api';
import { X, MessageSquare, ExternalLink, CheckCircle2, AlertTriangle, Send, Unlink } from 'lucide-react';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSlackConnected: boolean;
  onStatusChange: (status: boolean) => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  isSlackConnected,
  onStatusChange,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOAuthConnect = async () => {
    try {
      const url = await slackApi.getAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      setError('Could not retrieve Slack OAuth URL: ' + err.message);
    }
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      setError('Invalid Slack Webhook URL. Format: https://hooks.slack.com/services/...');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await slackApi.saveWebhook(webhookUrl);
      onStatusChange(true);
      setTestStatus('Webhook saved! Try sending a test alert below.');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to connect Slack webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await slackApi.disconnect();
      onStatusChange(false);
      setWebhookUrl('');
      setTestStatus('Slack disconnected successfully.');
    } catch (err: any) {
      setError('Failed to disconnect Slack');
    } finally {
      setLoading(false);
    }
  };

  const handleTestAlert = async () => {
    setLoading(true);
    setError(null);
    setTestStatus(null);
    try {
      await slackApi.testNotification('demo-sender@reachinbox.ai');
      setTestStatus('Test rate limit alert successfully posted to your Slack channel!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to dispatch Slack test alert');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#0E1322]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-[#4A154B]/30 text-[#ECB22E] rounded-lg border border-[#4A154B]">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Slack Rate-Limit Integration</h2>
              <p className="text-xs text-gray-400">Receive live alerts when hourly send thresholds are reached</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {testStatus && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{testStatus}</span>
            </div>
          )}

          {/* Status Indicator */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0B0F19] border border-gray-800">
            <div>
              <p className="text-xs font-medium text-gray-300">Connection Status</p>
              <p className="text-[11px] text-gray-500">
                {isSlackConnected
                  ? 'Active — Rate limit notifications will be sent live'
                  : 'Disconnected — Notifications disabled (no crashes on rate limits)'}
              </p>
            </div>
            <span
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                isSlackConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isSlackConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                }`}
              />
              <span>{isSlackConnected ? 'Connected' : 'Not Connected'}</span>
            </span>
          </div>

          {/* Option A: OAuth Flow */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-300">Method 1: Slack OAuth Flow</p>
            <button
              onClick={handleOAuthConnect}
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-[#4A154B] hover:bg-[#611f69] transition shadow-md"
            >
              <MessageSquare className="w-4 h-4 text-[#ECB22E]" />
              <span>Connect with Slack OAuth</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-800"></div>
            <span className="flex-shrink mx-3 text-[10px] uppercase font-semibold text-gray-500">
              OR DIRECT WEBHOOK
            </span>
            <div className="flex-grow border-t border-gray-800"></div>
          </div>

          {/* Option B: Direct Incoming Webhook */}
          <form onSubmit={handleSaveWebhook} className="space-y-2">
            <label className="block text-xs font-semibold text-gray-300">
              Method 2: Incoming Webhook URL
            </label>
            <div className="flex space-x-2">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="flex-1 bg-[#0B0F19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <button
                type="submit"
                disabled={loading || !webhookUrl}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
              >
                Save
              </button>
            </div>
            <p className="text-[10px] text-gray-500">
              Paste your Slack Incoming Webhook URL to verify live notifications instantly.
            </p>
          </form>

          {/* Actions: Test Alert & Disconnect */}
          {isSlackConnected && (
            <div className="pt-3 border-t border-gray-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestAlert}
                disabled={loading}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Dispatch Live Test Alert</span>
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                disabled={loading}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
