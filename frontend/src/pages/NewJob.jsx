import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Sparkles, Play, Sliders, CheckCircle, AlertCircle, Info } from 'lucide-react';

export default function NewJob() {
  const [prompt, setPrompt] = useState(
    'Estimate pi using 200 million samples, split into chunks of 5 million'
  );
  const [interpreting, setInterpreting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [totalSamples, setTotalSamples] = useState(200_000_000);
  const [chunkSize, setChunkSize] = useState(5_000_000);
  const [explanation, setExplanation] = useState('200M samples distributed across 40 tasks');
  const [isFallback, setIsFallback] = useState(false);
  const [hasInterpreted, setHasInterpreted] = useState(false);

  const navigate = useNavigate();

  const handleInterpret = async () => {
    if (!prompt.trim()) return;
    setError(null);
    setInterpreting(true);

    try {
      const res = await api.post('/jobs/interpret', { prompt });
      const { params, explanation: exp, fallback } = res.data;

      setTotalSamples(params.totalSamples);
      setChunkSize(params.chunkSize);
      setExplanation(exp || '');
      setIsFallback(Boolean(fallback));
      setHasInterpreted(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to interpret prompt');
    } finally {
      setInterpreting(false);
    }
  };

  const handleRunJob = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await api.post('/jobs', {
        type: 'MONTE_CARLO_PI',
        params: {
          totalSamples: Number(totalSamples),
          chunkSize: Number(chunkSize),
        },
        rawPrompt: prompt,
        aiConfig: {
          explanation,
          fallback: isFallback,
        },
      });

      const { job } = res.data;
      navigate(`/jobs/${job._id}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to launch job');
      setSubmitting(false);
    }
  };

  const quickPrompts = [
    'Estimate pi using half a billion samples',
    'Calculate Pi with 100M samples in chunks of 5 million',
    'Fast demo: 20 million samples with 2M chunks',
    'Heavy workload: 1 billion samples with 10M chunks',
  ];

  const calculatedTasks = Math.ceil(totalSamples / chunkSize) || 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Launch Distributed Job</h1>
        <p className="text-gray-400 text-sm mt-1">
          Describe what you want to compute in plain English. Gemini validates and constructs the parallel execution plan.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* AI Prompt Input Section */}
      <div className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl space-y-4">
        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
          Natural Language Job Description
        </label>

        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Estimate pi using 500 million samples, split into chunks of 10 million"
          className="w-full p-3.5 rounded-xl bg-gray-950 border border-gray-800 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />

        {/* Quick prompt chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-gray-500">Quick suggestions:</span>
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setPrompt(p)}
              className="text-xs px-2.5 py-1 rounded-lg bg-gray-800/80 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-700/60 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleInterpret}
            disabled={interpreting || !prompt.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Sparkles className="w-4 h-4 text-indigo-200" />
            <span>{interpreting ? 'Compiling with AI...' : 'Compile with Gemini AI'}</span>
          </button>
        </div>
      </div>

      {/* Structured Job Configuration & Preview Box */}
      <form
        onSubmit={handleRunJob}
        className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl space-y-6"
      >
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-sm text-white">Execution Parameters</h2>
          </div>
          {hasInterpreted && (
            <span
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                isFallback
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {isFallback ? '⚡ Compiled via Fallback Parser' : '✨ Compiled by Gemini'}
            </span>
          )}
        </div>

        {explanation && (
          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
            <span>{explanation}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Total Samples
            </label>
            <input
              type="number"
              min={10000}
              max={2000000000}
              required
              value={totalSamples}
              onChange={(e) => setTotalSamples(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-gray-950 border border-gray-800 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              {(totalSamples / 1e6).toFixed(1)} million points
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Task Chunk Size
            </label>
            <input
              type="number"
              min={10000}
              max={50000000}
              required
              value={chunkSize}
              onChange={(e) => setChunkSize(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-gray-950 border border-gray-800 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Will create ~{calculatedTasks} tasks
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gray-950/60 border border-gray-800 flex items-center justify-between text-xs">
          <div className="text-gray-400">
            Workload: <strong className="text-white">Monte Carlo Pi</strong>
          </div>
          <div className="text-gray-400">
            Tasks to Distribute: <strong className="text-blue-400 font-mono text-sm">{calculatedTasks}</strong>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting || totalSamples <= 0 || chunkSize <= 0}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-500/25"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{submitting ? 'Dispatching...' : 'Dispatch Job to Cluster'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
