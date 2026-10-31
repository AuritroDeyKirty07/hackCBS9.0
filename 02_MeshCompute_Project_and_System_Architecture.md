# Part 2: System Design

## 2.1 Architecture

```
                    +-------------------------------+
                    |   React Dashboard (Frontend)  |
                    |  auth, workers, jobs, charts  |
                    +---------------+---------------+
                                    | REST (JWT) + Socket.IO (/dashboard)
                                    v
 +-----------+       +-------------------------------+       +-----------+
 | Gemini API|<----->|     Backend Coordinator       |<----->|  MongoDB  |
 |  (NL->JSON)       |  Node + Express + Socket.IO   |       |  users,   |
 +-----------+       |  job splitter, scheduler,     |       |  workers, |
                     |  heartbeat monitor, aggregator|       |  jobs,    |
                     +-------+---------------+-------+       |  tasks    |
                             | Socket.IO (/workers)          +-----------+
              +--------------+---------------+
              v              v               v
        +-----------+  +-----------+   +-----------+
        | Worker 1  |  | Worker 2  |   | Worker N  |
        | Node agent|  | Node agent|   | Node agent|
        +-----------+  +-----------+   +-----------+
```

### Components

1. **Frontend:** React + Tailwind + Zustand + Recharts. Login, worker list with live CPU/RAM, job submission (natural language box plus the generated config preview), live progress, results, history, speedup chart.
2. **Coordinator:** Node + Express + Socket.IO + Mongoose. Owns all state transitions for jobs and tasks.
3. **Database:** MongoDB for users, workers, jobs, tasks, execution history.
4. **Worker Agent:** standalone Node app. Connects out to the coordinator (so no inbound ports or firewall changes), registers, sends heartbeats, runs tasks in `worker_threads`, returns results.
5. **AI integration:** Gemini API converts natural-language requests into a JSON job config. The output is validated against a schema and a whitelist, shown to the user for confirmation, and only then used. The LLM output is never executed.

## 2.2 Monorepo layout

```
meshcompute/
  package.json              (npm workspaces)
  .env.example
  README.md
  shared/
    constants.js            event names, task types, statuses, limits
  coordinator/
    src/
      index.js              Express + Socket.IO bootstrap
      config.js
      models/               User.js Worker.js Job.js Task.js
      routes/               auth.js workers.js jobs.js
      sockets/              workerNamespace.js dashboardNamespace.js
      services/
        jobSplitter.js      splits a job into tasks
        scheduler.js        picks which worker gets which task
        heartbeatMonitor.js detects dead workers, requeues tasks
        aggregator.js       combines partial results
        aiInterpreter.js    Gemini call + validation + fallback
        baselineRunner.js   single-machine measurement
      middleware/           auth.js error.js
    tests/
  worker-agent/
    src/
      index.js              connect, register, heartbeat, handle tasks
      taskRunner.js         worker_threads pool
      tasks/montecarloPi.js pure function, seeded PRNG
      sysinfo.js            cores, RAM, load
  frontend/
    src/
      pages/                Login Dashboard Workers NewJob JobDetail History
      components/
      store/                useAuthStore useWorkerStore useJobStore (Zustand)
      lib/socket.js api.js
```

## 2.3 Data models (Mongoose)

**User:** `email`, `passwordHash`, `name`, `role` (`consumer` | `provider` | `both`), `workerToken` (secret for registering workers), `createdAt`.

**Worker:** `workerId` (uuid persisted on the worker), `owner` (User ref), `name`, `platform`, `cpuCores`, `totalRamMB`, `status` (`online` | `busy` | `offline`), `socketId`, `lastHeartbeatAt`, `lastCpuLoad`, `lastFreeRamMB`, `maxConcurrentTasks`, `stats` (`tasksCompleted`, `totalComputeMs`).

**Job:** `owner`, `type` (`MONTE_CARLO_PI`), `params` (`{ totalSamples, chunkSize }`), `rawPrompt` (original natural-language text), `aiConfig` (what the LLM returned), `status` (`pending` | `running` | `completed` | `failed` | `cancelled`), `totalTasks`, `completedTasks`, `result` (`{ piEstimate, insideCount, totalCount, error }`), `timing` (`startedAt`, `finishedAt`, `durationMs`), `baseline` (`{ durationMs, piEstimate }`), `createdAt`.

**Task:** `job`, `index`, `type`, `params` (`{ samples, seed }`), `status` (`pending` | `assigned` | `running` | `completed` | `failed`), `assignedTo` (Worker ref), `attempt` (integer, starts at 1), `maxAttempts` (3), `assignedAt`, `completedAt`, `result` (`{ inside, total, computeMs }`), `history` (array of `{ worker, attempt, outcome, at }`).

## 2.4 Job lifecycle

1. Consumer submits natural language, or fills the form directly.
2. Coordinator calls Gemini and returns a structured config for confirmation.
3. Consumer confirms. A `Job` is created with status `pending`.
4. `jobSplitter` creates N `Task` documents, each with its own `samples` count and a **unique deterministic seed**.
5. `scheduler` assigns pending tasks to online workers with free capacity and emits `task:assign`.
6. Worker runs the task and emits `task:result`.
7. Coordinator validates and stores the result, marks the task `completed`, updates progress.
8. When all tasks are complete, `aggregator` computes `pi = 4 * sum(inside) / sum(total)` and marks the job `completed`.

## 2.5 Monte Carlo Pi task

Each task: generate `samples` random points in the unit square, count those with `x*x + y*y <= 1`, return `{ inside, total }`.

- Use a **seeded PRNG** (for example mulberry32 or xorshift128+), not `Math.random()`. Seeds make results reproducible and let you re-run a task and get the same answer.
- Workers run the loop inside a `worker_thread` so the main thread keeps sending heartbeats.
- The coordinator sums `inside` and `total` across tasks. Pi estimate = `4 * inside / total`.

## 2.6 Socket.IO protocol

Two namespaces: `/workers` (agents) and `/dashboard` (browsers).

**Worker to Coordinator** (`/workers`)

| Event | Payload |
|---|---|
| `worker:register` | `{ workerId, name, platform, cpuCores, totalRamMB, maxConcurrentTasks }` (auth via `workerToken` in the handshake) |
| `worker:heartbeat` | `{ workerId, cpuLoad, freeRamMB, activeTasks, ts }` every 3 s |
| `task:started` | `{ taskId, attempt }` |
| `task:result` | `{ taskId, jobId, attempt, result: { inside, total, computeMs } }` |
| `task:error` | `{ taskId, attempt, message }` |

**Coordinator to Worker**

| Event | Payload |
|---|---|
| `worker:registered` | `{ ok, heartbeatIntervalMs }` |
| `task:assign` | `{ taskId, jobId, attempt, type, params }` |
| `task:cancel` | `{ taskId }` |

**Coordinator to Dashboard** (`/dashboard`, authenticated with JWT)

| Event | Payload |
|---|---|
| `worker:update` | worker summary (status, load, RAM, active tasks) |
| `job:update` | `{ jobId, status, completedTasks, totalTasks, partialPi }` |
| `task:update` | `{ taskId, jobId, status, workerId, attempt }` |

## 2.7 REST API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | JWT auth |
| GET | `/api/auth/me` | Current user, includes worker token |
| GET | `/api/workers` | List workers with live stats |
| POST | `/api/jobs/interpret` | `{ prompt }` returns validated job config from Gemini |
| POST | `/api/jobs` | Create and start a job from a config |
| GET | `/api/jobs`, `/api/jobs/:id` | History, detail with tasks |
| POST | `/api/jobs/:id/cancel` | Cancel |
| POST | `/api/jobs/:id/baseline` | Run the same workload on one machine, store timing |

## 2.8 Scheduling (rule-based)

- Only schedule to workers with `status` online and `activeTasks < maxConcurrentTasks`.
- Pick the eligible worker with the most free capacity (fewest active tasks, then lowest CPU load).
- Use **small chunks** (many more tasks than workers) so fast workers naturally take more work and the load balances itself.
- Run the scheduler on events: task completed, worker joined, worker lost, job created. Not on a timer alone.

## 2.9 Fault tolerance

- **Heartbeats:** workers send one every 3 s. A monitor runs every 3 s. If `now - lastHeartbeatAt > 10 s` the worker is `offline`.
- **Reassignment:** when a worker goes offline (or its socket disconnects), every task in `assigned` or `running` for it goes back to `pending` with `attempt += 1` and a history entry. The scheduler then picks it up.
- **Max attempts:** after `maxAttempts` failures the task and job are marked `failed` with a clear reason.
- **Duplicate-result protection:** accept a result only if the task is not already `completed` **and** `(taskId, attempt)` matches the current attempt. A late result from a worker that was presumed dead is ignored (log it).
- **Validation:** check `0 <= inside <= total` and `total === task.params.samples`. Reject and retry otherwise.
- **Resource limits:** cap threads per worker (`MAX_CORES`), cap samples per task, and enforce a per-task timeout on the coordinator.
- **Worker reconnect:** a worker that reconnects re-registers with the same `workerId` and gets no stale tasks.

## 2.10 AI integration (Gemini)

**Purpose:** turn "Estimate pi with half a billion samples, split it up nicely" into:

```json
{
  "type": "MONTE_CARLO_PI",
  "params": { "totalSamples": 500000000, "chunkSize": 5000000 },
  "explanation": "Pi estimation using 500M random samples in 100 tasks"
}
```

**Safety rules**

- Ask Gemini for JSON only (response schema / JSON mode).
- Validate with a schema library (zod). `type` must be in the whitelist. Clamp `totalSamples` and `chunkSize` to safe ranges.
- If Gemini fails or returns junk, fall back to a simple regex parser (numbers with k/m/b suffixes) or to the manual form.
- The user always sees and confirms the config before it runs.
- Gemini never receives secrets and its output is never executed.

**Future:** AI-assisted resource recommendations (Phase 4) and ML-based scheduling (Phase 5), trained on stored task history (`computeMs` per worker).

## 2.11 Honest benchmarking

The demo claim is "distributed is faster", so measure it fairly:

- Baseline = the **same task code** run on **one machine** (single thread, and optionally all cores) for the **same total samples**.
- Report wall-clock time for both, plus speedup = `baseline / distributed`.
- Note the overhead: for small jobs, distribution can be slower. Pick a workload large enough (tens of seconds on one machine) to show a real gain.
- Store both timings on the `Job` and draw them in a Recharts bar chart.

## 2.12 Roadmap

| Phase | Goal |
|---|---|
| 1 | Coordinator plus workers over Socket.IO, task creation, distribution, aggregation, Monte Carlo (CLI-level proof) |
| 2 | Heartbeats, failure detection, reassignment, duplicate-result protection |
| 3 | MERN app: auth, worker monitoring, job submission, progress dashboard, history |
| 4 | Gemini natural-language job interpretation, structured config, recommendations |
| 5 | Predictive scheduling, compute credits, Docker isolation, P2P (WebRTC / libp2p) |

## 2.13 Hackathon demo script

1. Show the dashboard with 2 to 4 workers online, each with cores and RAM.
2. Type a natural-language job. Show the generated config and confirm.
3. Watch tasks fan out across workers and progress update live.
4. Kill one worker mid-job. Show it go offline, its tasks reassigned, and the job still complete.
5. Show the final Pi value and the single-machine vs distributed timing chart.

**Prepare backups:** a recorded video of the demo, a pre-run job in history, and a local-only mode (all workers on one laptop) in case venue Wi-Fi fails. Run the coordinator on a laptop on a mobile hotspot or LAN, and test worker connectivity beforehand.

## 2.14 Risks and mitigations

| Risk | Mitigation |
|---|---|
| Venue network blocks WebSockets or isolates clients | Test early, use a hotspot, keep a one-laptop fallback |
| Distribution slower than baseline on small jobs | Use a big enough workload, report overhead honestly |
| Gemini rate limits or downtime | Regex fallback plus manual form |
| Worker event loop blocked, heartbeats missed | Run compute in `worker_threads` |
| Double-counting results after reassignment | Attempt numbers, idempotent result acceptance |
| Scope creep | Phases 1 to 3 first; AI and extras only after the demo path works |

---
