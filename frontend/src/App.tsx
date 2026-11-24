import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { EmailListView } from './components/EmailListView';
import { ComposeView } from './components/ComposeView';
import { EmailDetailView } from './components/EmailDetailView';
import { SlackModal } from './components/SlackModal';
import { emailApi, slackApi } from './services/api';
import { EmailJob, SystemStats } from './types';

export const App: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [viewMode, setViewMode] = useState<'list' | 'compose' | 'detail'>('list');
  const [selectedEmail, setSelectedEmail] = useState<EmailJob | null>(null);

  const [scheduledEmails, setScheduledEmails] = useState<EmailJob[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailJob[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [isSlackConnected, setIsSlackConnected] = useState(false);

  // Fetch all dashboard data
  const fetchData = useCallback(async () => {
    try {
      const [scheduled, sent, systemStats, slackStatus] = await Promise.all([
        emailApi.getScheduledEmails(),
        emailApi.getSentEmails(),
        emailApi.getStats(),
        slackApi.getStatus(),
      ]);

      setScheduledEmails(scheduled);
      setSentEmails(sent);
      setStats(systemStats);
      setIsSlackConnected(slackStatus);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [user, fetchData]);

  // Handle Search using Elasticsearch endpoint
  useEffect(() => {
    if (!searchQuery.trim()) {
      fetchData();
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await emailApi.searchEmails(searchQuery);
        if (activeTab === 'scheduled') {
          setScheduledEmails(results.filter((e) => ['SCHEDULED', 'DELAYED', 'PROCESSING'].includes(e.status)));
        } else {
          setSentEmails(results.filter((e) => ['SENT', 'FAILED'].includes(e.status)));
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, fetchData]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleCancelEmail = async (id: string) => {
    try {
      await emailApi.cancelEmail(id);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel email');
    }
  };

  // 1. Unauthenticated View matching Figma Image 1
  if (!user) {
    return <LoginView />;
  }

  // 2. Authenticated Main Layout matching Figma
  return (
    <div className="flex h-screen bg-white text-gray-900 overflow-hidden font-sans">
      {/* Left Sidebar matching Figma Image 2 & 3 */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setViewMode('list');
        }}
        onOpenCompose={() => setViewMode('compose')}
        onOpenSlack={() => setIsSlackOpen(true)}
        isSlackConnected={isSlackConnected}
        scheduledCount={stats ? stats.scheduled : scheduledEmails.length}
        sentCount={stats ? stats.sent : sentEmails.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {viewMode === 'compose' ? (
          <ComposeView
            onBack={() => setViewMode('list')}
            onScheduledSuccess={() => {
              fetchData();
              setActiveTab('scheduled');
            }}
          />
        ) : viewMode === 'detail' && selectedEmail ? (
          <EmailDetailView
            email={selectedEmail}
            onBack={() => setViewMode('list')}
            onCancel={handleCancelEmail}
          />
        ) : (
          <EmailListView
            activeTab={activeTab}
            emails={activeTab === 'scheduled' ? scheduledEmails : sentEmails}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onRefresh={handleManualRefresh}
            isRefreshing={refreshing}
            onSelectEmail={(email) => {
              setSelectedEmail(email);
              setViewMode('detail');
            }}
          />
        )}
      </main>

      {/* Slack Integration Modal */}
      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        isSlackConnected={isSlackConnected}
        onStatusChange={(status) => setIsSlackConnected(status)}
      />
    </div>
  );
};

export default App;
