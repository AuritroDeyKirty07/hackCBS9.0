import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useJobStore } from '../store/useJobStore.js';
import { api } from '../lib/api.js';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Gauge,
  Cpu,
  Layers,
  Zap,
} from 'lucide-react';

export default function JobDetail() {
  const { id } = useParams();
  const { currentJob, currentTasks, fetchJobById, handleJobUpdate, handleTaskUpdate } =
    useJobStore();
  const [runningBaseline, setRunningBaseline] = useState(false);
  const [baselineError, setBaselineError] = useState(null);

  useEffect(() => {
    fetchJobById(id);
    const interval = setInterval(() => {
      fetchJobById(id);
    }, 2000);
    return () => clearInterval(interval);
  }, [id]);

  const handleRunBaseline = async () => {
    setRunningBaseline(true);
    setBaselineError(null);
    try {
      const res = await api.post(`/jobs/${id}/baseline`);
      handleJobUpdate(res.data.job);
      fetchJobById(id);
    } catch (err) {
      setBaselineError(err.response?.data?.error || err.message || 'Baseline run failed');
    } finally {
      setRunningBaseline(false);
    }
  };

  if (!currentJob) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-500">
        Loading job parameters and tasks...
      </div>
    );
  }

  const isCompleted = currentJob.status === 'completed';
  const progressPct =
    currentJob.totalTasks > 0
      ? Math.round(((currentJob.completedTasks || 0) / currentJob.totalTasks) * 100)
      : 0;

  const piEstimate = currentJob.result?.piEstimate;
  const errorMargin =
    piEstimate != null ? Math.abs(piEstimate - Math.PI).toFixed(7) : null;

  // Chart data for Baseline vs Distributed
  const chartData = [];
  let speedup = null;

  if (currentJob.baseline?.durationMs && currentJob.timing?.durationMs) {
    const singleSec = (currentJob.baseline.durationMs / 1000).toFixed(2);
    const distSec = (currentJob.timing.durationMs / 1000).toFixed(2);
    chartData.push(
      { name: 'Single Machine', time: parseFloat(singleSec) },
      { name: 'Distributed Mesh', time: parseFloat(distSec) }
    );
    speedup = (currentJob.baseline.durationMs / currentJob.timing.durationMs).toFixed(1);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Control Center</span>
        </Link>

        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
              currentJob.status === 'completed'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : currentJob.status === 'running'
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse'
                : currentJob.status === 'failed'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'bg-gray-500/15 text-gray-400 border border-gray-500/30'
            }`}
          >
            ● {currentJob.status}
          </span>
        </div>
      </div>

      {/* Main Job Overview Card */}
      <div className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                {currentJob.type}
              </h1>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">ID: {currentJob._id}</p>
          </div>

          <div className="flex items-center gap-6 text-xs text-gray-400">
            <div>
              <span>Total Points:</span>{' '}
              <strong className="text-white font-mono">
                {currentJob.params?.totalSamples?.toLocaleString()}
              </strong>
            </div>
            <div>
              <span>Chunk Size:</span>{' '}
              <strong className="text-white font-mono">
                {currentJob.params?.chunkSize?.toLocaleString()}
              </strong>
            </div>
            <div>
              <span>Duration:</span>{' '}
              <strong className="text-blue-400 font-mono">
                {currentJob.timing?.durationMs
                  ? `${(currentJob.timing.durationMs / 1000).toFixed(2)}s`
                  : 'Computing...'}
              </strong>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>
              Distributed Execution Progress:{' '}
              <strong className="text-white">{progressPct}%</strong>
            </span>
            <span>
              {currentJob.completedTasks || 0} of {currentJob.totalTasks || 0} sub-tasks completed
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-gray-950 overflow-hidden p-0.5 border border-gray-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isCompleted
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Real-time Math Estimation Result Box */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800">
            <span className="text-xs text-gray-400 block mb-1">Estimated Value of π</span>
            <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
              {piEstimate != null ? piEstimate.toFixed(8) : 'Calculating...'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800">
            <span className="text-xs text-gray-400 block mb-1">True Value (Math.PI)</span>
            <span className="text-2xl font-bold font-mono text-gray-300 tracking-tight">
              3.14159265
            </span>
          </div>

          <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800">
            <span className="text-xs text-gray-400 block mb-1">Absolute Error Margin</span>
            <span className="text-2xl font-bold font-mono text-blue-400 tracking-tight">
              {errorMargin != null ? `±${errorMargin}` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Benchmark: Single-Machine Baseline vs Distributed Mesh */}
      <div className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Gauge className="w-5 h-5 text-amber-400" />
              <span>Honest Benchmark: Single Core vs Distributed Mesh</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Compare execution time on a standalone machine against the distributed cluster.
            </p>
          </div>

          <button
            onClick={handleRunBaseline}
            disabled={runningBaseline || !isCompleted}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-lg shadow-amber-500/20 shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>{runningBaseline ? 'Benchmarking Baseline...' : 'Run Single-Machine Baseline'}</span>
          </button>
        </div>

        {baselineError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {baselineError}
          </div>
        )}

        {chartData.length > 0 ? (
          <div className="space-y-4 pt-2">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} unit="s" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="time" radius={[6, 6, 0, 0]}>
                    <Cell fill="#f59e0b" />
                    <Cell fill="#3b82f6" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold gap-2">
              <Zap className="w-4 h-4" />
              <span>
                Distributed Mesh is <strong className="font-mono text-base">{speedup}x</strong>{' '}
                faster than single-machine computation!
              </span>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-gray-950/40 rounded-xl border border-gray-800/80 text-xs text-gray-500">
            {isCompleted
              ? 'Click "Run Single-Machine Baseline" to generate benchmark comparison.'
              : 'Benchmark can be executed once the distributed job has completed.'}
          </div>
        )}
      </div>

      {/* Task Breakdown Table */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>Task Allocation Matrix ({currentTasks.length} sub-tasks)</span>
          </h2>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-gray-950 text-gray-400 border-b border-gray-800 uppercase text-[10px] tracking-wider z-10">
              <tr>
                <th className="py-2.5 px-4">Task #</th>
                <th className="py-2.5 px-4">Samples</th>
                <th className="py-2.5 px-4">Worker Node</th>
                <th className="py-2.5 px-4">Attempt</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Execution Time</th>
                <th className="py-2.5 px-4 text-right">Inside Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {currentTasks.map((task) => (
                <tr key={task._id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-2.5 px-4 font-mono font-medium text-white">
                    #{task.index}
                  </td>
                  <td className="py-2.5 px-4 text-gray-300 font-mono">
                    {task.params?.samples?.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-gray-300">
                    {task.assignedWorkerId || '—'}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-gray-400">
                    {task.attempt} / {task.maxAttempts}
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        task.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : task.status === 'running'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : task.status === 'assigned'
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : task.status === 'failed'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-gray-500/10 text-gray-400'
                      }`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-gray-300">
                    {task.result?.computeMs != null ? `${task.result.computeMs}ms` : '—'}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-right text-gray-400">
                    {task.result?.inside != null ? task.result.inside.toLocaleString() : '—'}
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
