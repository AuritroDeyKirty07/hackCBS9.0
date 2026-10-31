import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Sparkles, Play, Sliders, AlertCircle, Info, Grid, Cpu, Layers } from 'lucide-react';

export default function NewJob() {
  const [prompt, setPrompt] = useState(
    'Multiply two 6x6 matrices in chunks of 1 row'
  );
  const [interpreting, setInterpreting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [jobType, setJobType] = useState('MATRIX_MULTIPLY');
  const [totalSamples, setTotalSamples] = useState(200_000_000);
  const [sampleChunkSize, setSampleChunkSize] = useState(5_000_000);

  // Matrix multiplication parameters
  const [matrixSize, setMatrixSize] = useState(6);
  const [matrixChunkSize, setMatrixChunkSize] = useState(1);

  const [explanation, setExplanation] = useState(
    'Parallel matrix multiplication of 6×6 matrices divided into 6 distributed row tasks'
  );
  const [isFallback, setIsFallback] = useState(false);
  const [hasInterpreted, setHasInterpreted] = useState(false);

  const navigate = useNavigate();

  const handleInterpret = async () => {
    if (!prompt.trim()) return;
    setError(null);
    setInterpreting(true);

    try {
      const res = await api.post('/jobs/interpret', { prompt });
      const { type, params, explanation: exp, fallback } = res.data;

      setJobType(type);
      if (type === 'MATRIX_MULTIPLY') {
        setMatrixSize(params.matrixSize || 1000);
        setMatrixChunkSize(params.chunkSize || 50);
      } else {
        setTotalSamples(params.totalSamples || 100_000_000);
        setSampleChunkSize(params.chunkSize || 5_000_000);
      }

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
      const params =
        jobType === 'MATRIX_MULTIPLY'
          ? {
            matrixSize: Number(matrixSize),
            chunkSize: Number(matrixChunkSize),
          }
          : {
            totalSamples: Number(totalSamples),
            chunkSize: Number(sampleChunkSize),
          };

      const res = await api.post('/jobs', {
        type: jobType,
        params,
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
    {
      label: '🔢 5×5 Matrix (5 tasks, 1 row/chunk)',
      prompt: 'Multiply two 5x5 matrices in chunks of 1 row',
      type: 'MATRIX_MULTIPLY',
      params: { matrixSize: 5, chunkSize: 1 },
      explanation: 'Parallel distributed multiplication of 5×5 matrices partitioned into 5 row tasks',
    },
    {
      label: '🔢 6×6 Matrix (6 tasks, 1 row/chunk)',
      prompt: 'Multiply two 6x6 matrices in chunks of 1 row',
      type: 'MATRIX_MULTIPLY',
      params: { matrixSize: 6, chunkSize: 1 },
      explanation: 'Parallel distributed multiplication of 6×6 matrices partitioned into 6 row tasks',
    },
    {
      label: '⚡ 8×8 Matrix (4 tasks, 2 rows/chunk)',
      prompt: 'Multiply two 8x8 matrices in chunks of 2 rows',
      type: 'MATRIX_MULTIPLY',
      params: { matrixSize: 8, chunkSize: 2 },
      explanation: 'Parallel distributed multiplication of 8×8 matrices partitioned into 4 tasks of 2 rows',
    },
    {
      label: '🔢 Monte Carlo Pi (200M)',
      prompt: 'Estimate pi using 200 million samples split into chunks of 5 million',
      type: 'MONTE_CARLO_PI',
      params: { totalSamples: 200_000_000, chunkSize: 5_000_000 },
      explanation: 'Monte Carlo Pi estimation: 200M random trials distributed in 40 chunks of 5M',
    },
  ];

  const handleSelectTemplate = (p) => {
    setPrompt(p.prompt);
    setJobType(p.type);
    if (p.type === 'MATRIX_MULTIPLY') {
      setMatrixSize(p.params.matrixSize);
      setMatrixChunkSize(p.params.chunkSize);
    } else {
      setTotalSamples(p.params.totalSamples);
      setSampleChunkSize(p.params.chunkSize);
    }
    setExplanation(p.explanation);
    setHasInterpreted(true);
    setIsFallback(false);
  };

  const calculatedTasks =
    jobType === 'MATRIX_MULTIPLY'
      ? Math.ceil(matrixSize / matrixChunkSize) || 0
      : Math.ceil(totalSamples / sampleChunkSize) || 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Launch Distributed Job</h1>
        <p className="text-gray-400 text-sm mt-1">
          Describe your compute workload in plain English. Gemini parses parameters, partitions micro-tasks, and schedules across active cluster nodes.
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
          placeholder="e.g. Batch process 24 images with edge detection in chunks of 2"
          className="w-full p-3.5 rounded-xl bg-gray-950 border border-gray-800 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />

        {/* Quick prompt chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-gray-500">Quick templates:</span>
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectTemplate(p)}
              className="text-xs px-2.5 py-1 rounded-lg bg-gray-800/80 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-700/60 transition-colors"
            >
              {p.label}
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
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${isFallback
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

        {/* Workload Selector Tabs */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2">
            Selected Workload Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setJobType('MATRIX_MULTIPLY')}
              className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-colors ${jobType === 'MATRIX_MULTIPLY'
                  ? 'bg-blue-600/15 border-blue-500 text-white'
                  : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
            >
              <Grid className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <div className="font-semibold text-xs text-white">Distributed Matrix Multiplication</div>
                <div className="text-[11px] text-gray-400">Heavy O(N³) linear algebra & GFLOPS</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setJobType('MONTE_CARLO_PI')}
              className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-colors ${jobType === 'MONTE_CARLO_PI'
                  ? 'bg-purple-600/15 border-purple-500 text-white'
                  : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
            >
              <Cpu className="w-5 h-5 text-purple-400 shrink-0" />
              <div>
                <div className="font-semibold text-xs text-white">Monte Carlo Pi Simulation</div>
                <div className="text-[11px] text-gray-400">High-throughput stochastic math</div>
              </div>
            </button>
          </div>
        </div>

        {/* Dynamic Fields for MATRIX_MULTIPLY */}
        {jobType === 'MATRIX_MULTIPLY' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Matrix Dimension (N × N)
              </label>
              <input
                type="number"
                min={2}
                max={20}
                required
                value={matrixSize}
                onChange={(e) => setMatrixSize(parseInt(e.target.value, 10) || 2)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-gray-950 border border-gray-800 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Computes <strong className="text-blue-400 font-mono">{matrixSize}×{matrixSize}</strong> dense product ({matrixSize * matrixSize} total elements)
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Rows per Task Chunk
              </label>
              <input
                type="number"
                min={1}
                max={matrixSize}
                required
                value={matrixChunkSize}
                onChange={(e) => setMatrixChunkSize(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-gray-950 border border-gray-800 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Partitions into <strong className="text-amber-400 font-mono">{calculatedTasks}</strong> distributed task(s)
              </p>
            </div>
          </div>
        ) : (
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
                value={sampleChunkSize}
                onChange={(e) => setSampleChunkSize(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-gray-950 border border-gray-800 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-[11px] text-gray-500 mt-1">Will generate {calculatedTasks} tasks</p>
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-gray-950/60 border border-gray-800 flex items-center justify-between text-xs">
          <div className="text-gray-400">
            Target Workload: <strong className="text-white">{jobType}</strong>
          </div>
          <div className="text-gray-400">
            Tasks to Distribute:{' '}
            <strong className="text-blue-400 font-mono text-sm">{calculatedTasks}</strong>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting || calculatedTasks <= 0}
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
