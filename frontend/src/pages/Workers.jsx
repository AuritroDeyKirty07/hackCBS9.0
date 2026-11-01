import React, { useEffect, useState } from 'react';
import { useWorkerStore } from '../store/useWorkerStore.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { Server, Copy, Check, Terminal, Trash2, Laptop, Globe, ShieldCheck } from 'lucide-react';
import { API_URL } from '../lib/api.js';

export default function Workers() {
  const { workers, fetchWorkers, deleteWorker, cleanupOfflineWorkers } = useWorkerStore();
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [workerName, setWorkerName] = useState('my-computer');
  const [coordinatorUrl, setCoordinatorUrl] = useState(API_URL.replace(/\/api\/?$/, ''));
  const [platform, setPlatform] = useState('windows');

  useEffect(() => {
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 3000);
    return () => clearInterval(interval);
  }, []);

  const workerToken = user?.workerToken || 'demo-token';

  const safeName = workerName.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40) || 'my-computer';
  const normalizeCoordinator = (value) => {
    let address = value.trim();
    if (!address) return '';
    if (!/^https?:\/\//i.test(address)) address = `http://${address}`;
    try {
      const parsed = new URL(address);
      if (!parsed.port && parsed.protocol === 'http:') parsed.port = '4000';
      return parsed.origin;
    } catch {
      return '';
    }
  };
  const normalizedCoordinator = normalizeCoordinator(coordinatorUrl);
  const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;
  const command = platform === 'windows'
    ? `$env:COORDINATOR_URL=${shellQuote(normalizedCoordinator)}; $env:WORKER_TOKEN=${shellQuote(workerToken)}; $env:WORKER_NAME=${shellQuote(safeName)}; npm run worker`
    : `COORDINATOR_URL=${shellQuote(normalizedCoordinator)} WORKER_TOKEN=${shellQuote(workerToken)} WORKER_NAME=${shellQuote(safeName)} npm run worker`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
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

      {/* Worker connection wizard */}
      <section className="p-6 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 shadow-xl space-y-5">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-400" /> Connect another computer
          </h2>
          <p className="text-xs text-gray-400 mt-1">Configure the worker agent for this cluster and generate the exact command to run on the joining computer.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-gray-300">Host / Coordinator IP or URL</span>
            <div className="relative"><Globe className="absolute left-3 top-3 w-4 h-4 text-gray-500" /><input value={coordinatorUrl} onChange={(e) => setCoordinatorUrl(e.target.value)} placeholder="https://your-coordinator.example.com" className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white outline-none focus:border-blue-500" /></div>
            <span className="text-[10px] text-gray-500">Enter a host IP (for example 192.168.1.20) or deployed coordinator URL. A plain IP defaults to port 4000.</span>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-gray-300">Computer name</span>
            <div className="relative"><Laptop className="absolute left-3 top-3 w-4 h-4 text-gray-500" /><input value={workerName} onChange={(e) => setWorkerName(e.target.value)} maxLength={40} placeholder="e.g. lab-pc-01" className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white outline-none focus:border-blue-500" /></div>
            <span className="text-[10px] text-gray-500">Letters, numbers, hyphens and underscores are supported.</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-gray-400">Joining computer OS</span>
          <div className="flex rounded-lg border border-gray-700 p-1 bg-gray-950">
            {['windows', 'mac/linux'].map((os) => <button key={os} onClick={() => setPlatform(os === 'windows' ? 'windows' : 'unix')} className={`px-3 py-1.5 rounded-md text-xs capitalize ${((os === 'windows' && platform === 'windows') || (os === 'mac/linux' && platform === 'unix')) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>{os}</button>)}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-gray-300">Command to run on the joining computer</span><button onClick={handleCopy} disabled={!normalizedCoordinator || !workerToken} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold"><Copy className="w-3.5 h-3.5" />{copied ? 'Copied' : 'Copy command'}</button></div>
          <pre className="whitespace-pre-wrap break-all p-4 rounded-xl bg-black border border-gray-800 text-[11px] leading-relaxed text-emerald-300">{command}</pre>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg bg-gray-950/80 border border-gray-800 p-3"><b className="text-white block mb-1">1. Get the project</b><span className="text-gray-400">Clone/download MeshCompute on the joining PC and open a terminal in its root folder.</span></div>
          <div className="rounded-lg bg-gray-950/80 border border-gray-800 p-3"><b className="text-white block mb-1">2. Install dependencies</b><span className="text-gray-400">Run <code className="text-blue-300">npm install</code> once in the project root.</span></div>
          <div className="rounded-lg bg-gray-950/80 border border-gray-800 p-3"><b className="text-white block mb-1">3. Join the cluster</b><span className="text-gray-400">Paste the generated command into that computer's terminal. It will register and send heartbeats.</span></div>
        </div>

        <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200"><ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" /><p><b>Security:</b> This page cannot execute commands on a visitor's PC. The user must run the command locally. Treat the worker token as a password; only share it with trusted machines. For a cloud deployment, ensure the coordinator URL is public and uses HTTPS/WSS.</p></div>
      </section>

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

