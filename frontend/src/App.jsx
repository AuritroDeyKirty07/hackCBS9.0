import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore.js';
import { useWorkerStore } from './store/useWorkerStore.js';
import { useJobStore } from './store/useJobStore.js';
import { getDashboardSocket } from './lib/socket.js';
import { DASH_EVENTS } from 'meshcompute-shared/constants.js';

import Navbar from './components/Navbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import Workers from './pages/Workers.jsx';
import NewJob from './pages/NewJob.jsx';
import JobDetail from './pages/JobDetail.jsx';
import History from './pages/History.jsx';

export default function App() {
  const { fetchMe, token } = useAuthStore();
  const { handleWorkerUpdate } = useWorkerStore();
  const { handleJobUpdate, handleTaskUpdate, addActivity } = useJobStore();

  useEffect(() => {
    fetchMe();
  }, [token]);

  // Global Realtime Dashboard Socket setup
  useEffect(() => {
    const socket = getDashboardSocket();

    socket.on('connect', () => {
      console.log('[DashboardSocket] Connected to real-time cluster stream');
      addActivity('Connected to real-time cluster stream', 'info');
    });

    socket.on(DASH_EVENTS.WORKER_UPDATE, (worker) => {
      handleWorkerUpdate(worker);
      if (worker.status === 'offline') {
        addActivity(`Worker ${worker.workerId.slice(0, 8)} went offline`, 'warning');
      } else if (worker.status === 'online' && worker.name) {
        addActivity(`Worker ${worker.name} heartbeat active`, 'info');
      }
    });

    socket.on(DASH_EVENTS.JOB_UPDATE, (job) => {
      handleJobUpdate(job);
      if (job.status === 'completed') {
        addActivity(`Job ${job.jobId?.slice(0, 8)} completed with π = ${job.partialPi?.toFixed(6)}`, 'success');
      } else if (job.status === 'running') {
        addActivity(`Job ${job.jobId?.slice(0, 8)} dispatched across workers`, 'info');
      }
    });

    socket.on(DASH_EVENTS.TASK_UPDATE, (task) => {
      handleTaskUpdate(task);
      if (task.status === 'completed') {
        addActivity(`Task #${task.index} completed by worker ${task.workerId?.slice(0, 8) || 'node'}`, 'success');
      } else if (task.status === 'pending' && task.attempt > 1) {
        addActivity(`Task #${task.index} requeued for retry (attempt ${task.attempt})`, 'warning');
      }
    });

    return () => {
      socket.off(DASH_EVENTS.WORKER_UPDATE);
      socket.off(DASH_EVENTS.JOB_UPDATE);
      socket.off(DASH_EVENTS.TASK_UPDATE);
    };
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 flex flex-col font-sans">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/workers" element={<Workers />} />
            <Route path="/jobs/new" element={<NewJob />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/history" element={<History />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
