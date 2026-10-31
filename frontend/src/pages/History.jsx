import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useJobStore } from '../store/useJobStore.js';
import { History as HistoryIcon, ExternalLink, Calendar, Clock } from 'lucide-react';

export default function History() {
  const { jobs, fetchJobs } = useJobStore();

  useEffect(() => {
    fetchJobs();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Job History</h1>
        <p className="text-gray-400 text-sm mt-1">
          Review previous distributed simulations, total compute times, and benchmark results.
        </p>
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-950/60 text-gray-400 border-b border-gray-800 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Job ID</th>
              <th className="py-3.5 px-4">Workload</th>
              <th className="py-3.5 px-4">Compute Size</th>
              <th className="py-3.5 px-4">Tasks</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Duration</th>
              <th className="py-3.5 px-4">Result Summary</th>
              <th className="py-3.5 px-4">Date</th>
              <th className="py-3.5 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan="9" className="py-12 text-center text-gray-500 italic">
                  No jobs found in cluster history.
                </td>
              </tr>
            ) : (
              jobs.map((job) => {
                const date = new Date(job.createdAt).toLocaleString();
                const duration = job.timing?.durationMs
                  ? `${(job.timing.durationMs / 1000).toFixed(2)}s`
                  : '—';

                return (
                  <tr key={job._id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-gray-300">
                      {job._id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 font-medium text-white">
                      {job.type === 'MATRIX_MULTIPLY' ? (
                        <span className="text-blue-400">Dense Matrix Multiply</span>
                      ) : (
                        <span className="text-purple-400">Monte Carlo Pi</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-300 font-mono">
                      {job.type === 'MATRIX_MULTIPLY'
                        ? `${job.params?.matrixSize || job.result?.matrixSize || 1000}×${job.params?.matrixSize || job.result?.matrixSize || 1000} matrix`
                        : `${job.params?.totalSamples?.toLocaleString() || 0} samples`}
                    </td>
                    <td className="py-3 px-4 text-gray-400 font-mono">
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
                    <td className="py-3 px-4 font-mono text-gray-300">{duration}</td>
                    <td className="py-3 px-4 font-mono text-emerald-400">
                      {job.type === 'MATRIX_MULTIPLY'
                        ? `${job.result?.gflops ? `${job.result.gflops} GFLOPS` : `${job.result?.completedRows || 0} rows`}`
                        : job.result?.piEstimate
                        ? `π ≈ ${job.result.piEstimate.toFixed(6)}`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-[11px]">{date}</td>
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
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

