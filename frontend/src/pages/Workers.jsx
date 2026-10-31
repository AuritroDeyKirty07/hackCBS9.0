import React, { useEffect, useState } from 'react';
import { useWorkerStore } from '../store/useWorkerStore.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { Server, Copy, Check, Terminal, Cpu, HardDrive, Trash2 } from 'lucide-react';

export default function Workers() {
  const { workers, fetchWorkers, deleteWorker, cleanupOfflineWorkers } = useWorkerStore();
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 3000);
    return () => clearInterval(interval);
  }, []);

  const workerToken = user?.workerToken || 'demo-token';

  const handleCopy = () => {
    navigator.clipboard.writeText(workerToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCleanOffline = async () => {
    setCleaning(true);
    try {
      await cleanupOfflineWorkers();
      await fetchWorkers();
    } finally {
      setCleaning(false);
    }
  };

  const handleDeleteOne = async (workerId) => {
    await deleteWorker(workerId);
    await fetchWorkers();
  };

  const hasOffline = workers.some((w) => w.status !== 'online');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Worker Nodes</h1>
        <p className="text-gray-400 text-sm mt-1">
          Monitor connected machines and generate authentication tokens for new nodes.
        </p>
      </div>

      {/* Worker Token & Join Instructions Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-blue-400" />
              <span>Connect a New Machine to Cluster</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Run the worker agent on any computer with this secret token to lend CPU power.
            </p>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium transition-colors border border-gray-700 shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-gray-400" />
                <span>Copy Worker Token</span>
              </>
            )}
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 font-mono text-xs text-blue-400 overflow-x-auto">
          <code>
            WORKER_TOKEN={workerToken} WORKER_NAME=my-laptop npm run worker
          </code>
        </div>
      </div>

      {/* Workers Table */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            <h2 className="font-semibold text-white text-sm">
              Registered Cluster Nodes ({workers.length})
            </h2>
          </div>

          {hasOffline && (
            <button
              onClick={handleCleanOffline}
              disabled={cleaning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 hover:text-red-300 text-xs font-medium border border-red-500/20 transition-colors"
              title="Remove all disconnected or stale nodes from the cluster registry"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{cleaning ? 'Cleaning...' : 'Clean Offline Nodes'}</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-950/60 text-gray-400 border-b border-gray-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Node Name / ID</th>
                <th className="py-3 px-4">Platform</th>
                <th className="py-3 px-4">Capacity</th>
                <th className="py-3 px-4">Live CPU</th>
                <th className="py-3 px-4">Free RAM</th>
                <th className="py-3 px-4">In-Flight Tasks</th>
                <th className="py-3 px-4">Total Done</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {workers.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-gray-500 italic">
                    No worker nodes currently registered.
                  </td>
                </tr>
              ) : (
                workers.map((worker) => {
                  const isOnline = worker.status === 'online';
                  return (
                    <tr key={worker.workerId} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{worker.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          {worker.workerId}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                        {worker.platform || 'unknown'}
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {worker.cpuCores} cores / {Math.round((worker.totalRamMB || 0) / 1024)}GB
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all duration-500"
                              style={{ width: `${Math.min(100, worker.lastCpuLoad || 0)}%` }}
                            />
                          </div>
                          <span className="font-mono text-gray-300 text-[11px]">
                            {worker.lastCpuLoad || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                        {worker.lastFreeRamMB ? `${Math.round(worker.lastFreeRamMB)}MB` : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-amber-400">
                        {worker.activeTasks || 0} / {worker.maxConcurrentTasks || 4}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-emerald-400">
                        {worker.stats?.tasksCompleted || 0}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            isOnline
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                            }`}
                          />
                          {worker.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isOnline ? (
                          <button
                            onClick={() => handleDeleteOne(worker.workerId)}
                            title="Remove stale offline node"
                            className="p-1 px-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors border border-red-500/20 inline-flex items-center gap-1 text-[11px]"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-600 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

