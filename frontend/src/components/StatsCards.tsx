import React from 'react';
import { SystemStats } from '../types';
import { Clock, Send, AlertTriangle, Users } from 'lucide-react';

interface StatsCardsProps {
  stats: SystemStats | null;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const cards = [
    {
      title: 'Scheduled Queue',
      value: stats ? stats.scheduled : 0,
      icon: Clock,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
      subText: 'BullMQ delayed jobs',
    },
    {
      title: 'Sent Successfully',
      value: stats ? stats.sent : 0,
      icon: Send,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      subText: 'Via Ethereal SMTP',
    },
    {
      title: 'Failed Attempts',
      value: stats ? stats.failed : 0,
      icon: AlertTriangle,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
      subText: 'Non-recoverable errors',
    },
    {
      title: 'Active Senders',
      value: stats ? stats.activeSendersCount : 0,
      icon: Users,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      subText: 'Isolated rate limits',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className={`p-4 rounded-xl bg-[#111827] border ${card.borderColor} shadow-sm flex items-center justify-between`}
          >
            <div>
              <p className="text-xs font-medium text-gray-400">{card.title}</p>
              <h3 className="text-2xl font-bold text-white mt-1 tracking-tight">{card.value}</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">{card.subText}</p>
            </div>
            <div className={`p-3 rounded-lg ${card.bgColor} ${card.color}`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
