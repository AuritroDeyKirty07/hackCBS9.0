import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedDemoData } from './seedDemoData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const processes = [];

function runProcess(cmd, args, envVars = {}, name = '') {
  const proc = spawn(cmd, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...envVars },
  });

  proc.on('error', (err) => {
    console.error(`[${name}] Failed to start:`, err);
  });

  processes.push(proc);
  return proc;
}

async function startDemo() {
  console.log('===============================================================');
  console.log('  🚀 Launching MeshCompute AI Full Stack Hackathon Demo');
  console.log('===============================================================');

  // 1. Seed demo user & historical job
  try {
    await seedDemoData();
  } catch (err) {
    console.warn('[Demo] Could not seed database (will continue):', err.message);
  }

  // 2. Start Coordinator
  console.log('[Demo] Starting Backend Coordinator...');
  runProcess('node', ['coordinator/src/index.js'], {}, 'Coordinator');

  // Wait 2 seconds for Coordinator to start
  await new Promise((r) => setTimeout(r, 2000));

  // 3. Start 3 Worker Agents
  const workerToken = 'meshcompute-demo-worker-token';
  const workerNames = ['worker-alpha', 'worker-beta', 'worker-gamma'];

  for (const name of workerNames) {
    console.log(`[Demo] Spawning ${name}...`);
    runProcess(
      'node',
      ['worker-agent/src/index.js'],
      {
        WORKER_NAME: name,
        WORKER_TOKEN: workerToken,
      },
      name
    );
  }

  // 4. Start Frontend
  console.log('[Demo] Starting React Dashboard...');
  runProcess('npm', ['-w', 'frontend', 'run', 'dev'], {}, 'Frontend');

  console.log('\n===============================================================');
  console.log('  ✨ ALL SERVICES RUNNING:');
  console.log('  🌐 Frontend Dashboard: http://localhost:5173');
  console.log('  ⚙️ Backend Coordinator: http://localhost:4000');
  console.log('  🔑 Demo Credentials:   demo@meshcompute.ai / password123');
  console.log('  💻 Worker Nodes:       3 active workers connected');
  console.log('===============================================================\n');
}

process.on('SIGINT', () => {
  console.log('\n[Demo] Stopping all MeshCompute processes...');
  processes.forEach((p) => p.kill());
  process.exit(0);
});

startDemo();

