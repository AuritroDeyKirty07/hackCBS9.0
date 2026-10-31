# MeshCompute AI

> **One Job. Multiple Machines. Shared Computing Power.**
>
> A community-powered distributed computing platform that unites idle personal computers into a high-throughput parallel compute network. Pre-trusted batch workloads are split into deterministic micro-tasks, distributed to lightweight worker agents over WebSockets, and aggregated into verified results with Gemini-powered natural language job compilation.

---

## ⚡ Architecture Overview

```
                    +------------------------------------+
                    |     React Dashboard (Frontend)     |
                    |  Tailwind CSS + Zustand + Recharts |
                    +-----------------+------------------+
                                      | REST (JWT) + Socket.IO (/dashboard)
                                      v
 +----------------+       +------------------------------------+       +-------------+
 |   Gemini API   |<----->|        Backend Coordinator         |<----->|   MongoDB   |
 | (NL -> Config) |       |     Node + Express + Socket.IO     |       |   users,    |
 +----------------+       |  scheduler, splitter, aggregator,  |       |   workers,  |
                          |  heartbeat monitor & baseline run  |       |   jobs,     |
                          +-----------------+------------------+       |   tasks     |
                                            | Socket.IO (/workers)     +-------------+
                             +--------------+---------------+
                             v              v               v
                       +-----------+  +-----------+   +-----------+
                       | Worker α  |  | Worker β  |   | Worker γ  |
                       | Node.js   |  | Node.js   |   | Node.js   |
                       | Agent     |  | Agent     |   | Agent     |
                       +-----------+  +-----------+   +-----------+
```

### Components

1. **Frontend (`frontend/`)**: React (Vite) + Tailwind CSS + Zustand + Recharts + Lucide Icons. Real-time monitoring of cluster nodes, live progress bar, natural-language job compilation, task allocation matrix, and single-machine vs distributed benchmark chart.
2. **Coordinator (`coordinator/`)**: Node.js + Express + Socket.IO + Mongoose. Manages push-based task scheduling, fault detection via heartbeat monitoring, deterministic task splitting, and mathematical aggregation.
3. **Worker Agent (`worker-agent/`)**: Standalone Node.js daemon. Connects outbound (firewall friendly) via Socket.IO, reports system metrics, and executes whitelisted tasks in isolated background `worker_threads` so heartbeats are never blocked.
4. **AI Compiler (`coordinator/src/services/aiInterpreter.js`)**: Converts human requests (e.g., *"Estimate pi with half a billion samples in chunks of 5M"*) into a validated JSON execution plan using Gemini with a regex fallback parser.

---

## 🚀 Quick Start (One-Command Demo)

### Prerequisites

- Node.js ≥ 20
- npm ≥ 9
- MongoDB running locally at `mongodb://localhost:27017/meshcompute` (or configure `MONGODB_URI` in `.env`)

### 1-Click Launch

Run from the root directory:

```bash
npm run demo
```

This starts:
- The Backend Coordinator on `http://localhost:4000`
- 3 distributed Worker Agents (`worker-alpha`, `worker-beta`, `worker-gamma`)
- Seeds the demo user (`demo@meshcompute.ai` / `password123`) and sample job history
- The React Dashboard on `http://localhost:5173`

Open **`http://localhost:5173`** in your browser and click **"Quick 1-Click Demo Login"**!

---

## 🎬 5-Minute Hackathon Demo Script

1. **Show the Dashboard**: Show 3 active worker nodes with real-time animated CPU and RAM meters.
2. **Natural Language Job Input**:
   - Go to **New Job**.
   - Type: `"Estimate pi using 200 million samples split into chunks of 5 million"`.
   - Click **Compile with Gemini AI**.
   - Show the validated execution preview (200M points, 40 tasks).
3. **Live Distributed Fan-Out**:
   - Click **Dispatch Job to Cluster**.
   - Watch the 40 tasks get scheduled concurrently across all 3 workers in real-time.
   - Watch the live progress bar and partial $\pi$ estimation converge to `3.14159...`.
4. **Kill a Worker Mid-Job (Fault Tolerance Proof)**:
   - Terminate one worker in terminal (`Ctrl+C`).
   - The coordinator marks it offline within 10s (or instantly on socket disconnect).
   - In-flight tasks automatically revert to `pending` with `attempt: 2` and a history entry.
   - Remaining workers pick them up; the job completes with 100% data integrity and zero double-counting!
5. **Honest Speedup Benchmark**:
   - Click **Run Single-Machine Baseline**.
   - Recharts visualizes single-core execution time vs. the distributed mesh.
   - Shows real-world speedup (e.g., **2.5x faster** across cluster nodes).

---

## 🛠️ Individual Services & Scripts

You can also run any service independently:

```bash
# Run coordinator in development mode
npm run dev:coordinator

# Run React frontend
npm run dev:frontend

# Start a worker node
WORKER_NAME=my-laptop WORKER_TOKEN=meshcompute-dev-token npm run worker

# Run CLI job submission test
npm run submit-job -- --samples 100000000 --chunk 5000000

# Run full test suite (Vitest)
npm test
```

---

## 🛡️ Reliability & Security Decisions

| Security / Fault Measure | Implementation |
|---|---|
| **Whitelisted Workloads Only** | Workers **never** execute arbitrary code or user scripts. Handlers are imported from a hardcoded registry (`worker-agent/src/tasks/index.js`). |
| **Deterministic Seeded PRNG** | Tasks use `mulberry32(seed)` where `seed = hash(jobId + taskIndex)`. Guarantees reproducible mathematical verification. |
| **Outbound-Only Connections** | Workers connect *out* to the coordinator on `/workers` namespace. Requires zero inbound open ports or firewall changes. |
| **Duplicate Result Protection** | Results are accepted only if `task.status !== 'completed'` AND `payload.attempt === task.attempt`. Late results from presumed-dead workers are discarded. |
| **Worker Thread Isolation** | Compute tasks run in Node.js `worker_threads` so intensive CPU loops never starve the main thread's heartbeat loop. |

---

## 🔮 Future Architecture & Extensions

- **Task Type Registry**: Adding workloads (e.g., distributed image processing, CSV parallel map-reduce) requires only registering the type in `shared/constants.js` and adding a handler in `worker-agent/src/tasks/`.
- **ML-Based Predictive Scheduling**: Replaces the `RuleBasedSchedulerStrategy` with an ML model trained on recorded `computeMs` metrics per worker hardware profile.
- **Docker Isolation**: For running containerized workloads with hard memory and CPU quotas.
- **Decentralized P2P Mesh**: Upgrading worker-to-worker transport via WebRTC / libp2p.
- **Compute Credits & Proof of Compute**: Reward contributors based on verified CPU cycles.
