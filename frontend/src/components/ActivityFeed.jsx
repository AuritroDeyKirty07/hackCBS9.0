import React from 'react';
import { useJobStore } from '../store/useJobStore.js';
import { Radio, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export default function ActivityFeed() {
  const { activities } = useJobStore();

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="font-semibold text-sm text-gray-200">Real-Time Cluster Activity</h3>
        </div>
        <span className="text-xs text-gray-500">Live feed</span>
      </div>

      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 text-xs">
        {activities.length === 0 ? (
          <div className="text-gray-500 py-6 text-center italic">
            Cluster running smoothly. Awaiting job events...
          </div>
        ) : (
          activities.map((item) => {
            let Icon = Info;
            let iconColor = 'text-blue-400';
            if (item.type === 'success') {
              Icon = CheckCircle2;
              iconColor = 'text-emerald-400';
            } else if (item.type === 'warning') {
              Icon = AlertTriangle;
              iconColor = 'text-amber-400';
            }

            return (
              <div
                key={item.id}
                className="flex items-start gap-2.5 p-2 rounded-lg bg-gray-950/40 border border-gray-800/60"
              >
                <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${iconColor}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-300 break-words">{item.message}</p>
                </div>
                <span className="text-gray-500 text-[10px] shrink-0 font-mono">
                  {item.timestamp}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
