import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWorkerStore } from '../store/useWorkerStore.js';
import { useJobStore } from '../store/useJobStore.js';
import { useAuthStore } from '../store/useAuthStore.js';
import ActivityFeed from '../components/ActivityFeed.jsx';
import {
  Server,
  Cpu,
  Layers,
  CheckCircle2,
  Play,
  ArrowRight,
  ExternalLink,
  Zap,
} from 'lucide-react';

export default function Dashboard() {
  const { workers, fetchWorkers } = useWorkerStore();
  const { jobs, fetchJobs } = useJobStore();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchWorkers();
    fetchJobs();
    const interval = setInterval(() => {
      fetchWorkers();
      fetchJobs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const onlineWorkers = workers.filter((w) => w.status === 'online');
  const totalCores = workers.reduce((acc, w) => acc + (w.cpuCores || 0), 0);
  const totalActiveTasks = workers.reduce((acc, w) => acc + (w.activeTasks || 0), 0);
  const completedJobsCount = jobs.filter((j) => j.status === 'completed').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/20 border border-blue-500/20 backdrop-blur-xl">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            MeshCompute Control Center
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            One Job. Multiple Machines. Decentralized high-throughput compute.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/jobs/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Launch New Job</span>
          </Link>
        </div>
      </div>

      {/* Cluster Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-gray-900/70 border border-gray-800">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Active Workers</span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {onlineWorkers.length}{' '}
            <span className="text-xs font-normal text-gray-500">/ {workers.length} nodes</span>
          </div>
          <div className="mt-2 text-xs text-emerald-400 font-medium">
            ● Cluster Available
          </div>
        </div>

        <div className="p-5 rounded-xl bg-gray-900/70 border border-gray-800">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Compute Capacity</span>
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {totalCores}{' '}
            <span className="text-xs font-normal text-gray-500">CPU Threads</span>
          </div>
          <div className="mt-2 text-xs text-gray-400 font-medium">
            Across distributed nodes
          </div>
        </div>

        <div className="p-5 rounded-xl bg-gray-900/70 border border-gray-800">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">In-Flight Tasks</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">{totalActiveTasks}</div>
          <div className="mt-2 text-xs text-gray-400 font-medium">
            Worker thread allocations
          </div>
        </div>

        <div className="p-5 rounded-xl bg-gray-900/70 border border-gray-800">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Completed Jobs</span>
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">{completedJobsCount}</div>
          <div className="mt-2 text-xs text-purple-400 font-medium">
            Aggregated results
          </div>
        </div>
      </div>

      {/* Grid: Connected Workers & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Workers Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-400" />
              <span>Live Mesh Nodes</span>
            </h2>
            <Link
              to="/workers"
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {workers.length === 0 ? (
              <div className="col-span-2 p-8 rounded-xl bg-gray-900/50 border border-gray-800 text-center">
                <Server className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400 font-medium">No worker agents connected</p>
                <p className="text-xs text-gray-500 mt-1">
                  Start an agent in terminal: <code className="text-blue-400">npm run worker</code>
                </p>
              </div>
            ) : (
              workers.map((worker) => {
                const isOnline = worker.status === 'online';
                return (
                  <div
                    key={worker.workerId}
                    className="p-4 rounded-xl bg-gray-900/70 border border-gray-800 hover:border-gray-700 transition-colors space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                            }`}
                          />
                          <h3 className="font-semibold text-sm text-white">{worker.name}</h3>
                        </div>
                        <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                          ID: {worker.workerId.slice(0, 8)}...
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          isOnline
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {worker.status}
                      </span>
                    </div>

                    {/* CPU & RAM meters */}
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-gray-400 text-[11px] mb-1">
                          <span>CPU Load</span>
                          <span className="font-mono text-gray-200">
                            {worker.lastCpuLoad || 0}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, worker.lastCpuLoad || 0)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-gray-400 pt-1">
                        <span>Threads: <strong className="text-gray-200">{worker.cpuCores}</strong></span>
                        <span>Active: <strong className="text-amber-400">{worker.activeTasks || 0}</strong></span>
                        <span>Done: <strong className="text-emerald-400">{worker.stats?.tasksCompleted || 0}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Live Activity Feed Column */}
        <div className="space-y-4">
          <ActivityFeed />
        </div>
      </div>

      {/* Recent Jobs Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            <span>Recent Jobs</span>
          </h2>
          <Link
            to="/history"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
          >
            <span>View History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-950/60 text-gray-400 border-b border-gray-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Job ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Samples</th>
                <th className="py-3 px-4">Tasks</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Result (π)</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {jobs.slice(0, 5).map((job) => (
                <tr key={job._id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-3 px-4 font-mono text-gray-300">
                    {job._id.slice(0, 8)}...
                  </td>
                  <td className="py-3 px-4 font-medium text-white">{job.type}</td>
                  <td className="py-3 px-4 text-gray-300 font-mono">
                    {job.params?.totalSamples?.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-gray-400">
                    {job.completedTasks || 0} / {job.totalTasks || 0}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        job.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : job.status === 'running'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : job.status === 'failed'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-gray-500/10 text-gray-400'
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-400">
                    {job.result?.piEstimate ? job.result.piEstimate.toFixed(6) : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      to={`/jobs/${job._id}`}
                      className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-medium"
                    >
                      <span>Inspect</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
