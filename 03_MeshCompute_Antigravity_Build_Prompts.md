# Part 3: Antigravity Build Prompts

How to use: open an empty folder in Antigravity, paste the **Master Prompt** first, review the plan it produces, then feed the **Phase Prompts** one at a time. Do not move on until the acceptance checks for the phase pass.

## 3.1 Master Prompt

````
You are a senior full-stack engineer. Build "MeshCompute AI": a community-powered distributed computing platform. A central coordinator splits a computational job into small tasks, distributes them to worker agents running on different computers, collects partial results, and aggregates them into a final result. The first workload is a Monte Carlo simulation to estimate Pi.

## How to work
- FIRST produce an implementation plan (folder layout, data models, socket events, milestones) and wait for my review before writing code.
- Then build phase by phase. After each phase: run it, run the tests, and verify it works end-to-end (use the browser agent for UI checks), then summarize what you verified and what is left.
- Keep code simple, readable and well commented. I need to understand and explain every file at a hackathon, so prefer clarity over cleverness.
- Use JavaScript (ES modules), not TypeScript. Node 20+. Use npm workspaces.
- Commit after each phase with a clear message.

## Stack
- Frontend: React (Vite), Tailwind CSS, Zustand, Recharts, socket.io-client
- Coordinator: Node.js, Express, Socket.IO, Mongoose, JWT (jsonwebtoken), bcryptjs, zod, dotenv
- Database: MongoDB
- Worker Agent: separate Node.js app using socket.io-client and worker_threads
- AI: Gemini API (via @google/genai or the official Google generative AI SDK), key from env
- Tests: vitest or jest plus supertest for coordinator logic

## Monorepo layout
meshcompute/ with: shared/ (constants.js), coordinator/, worker-agent/, frontend/, root package.json (workspaces), .env.example, README.md.
Coordinator src: index.js, config.js, models/{User,Worker,Job,Task}.js, routes/{auth,workers,jobs}.js, sockets/{workerNamespace,dashboardNamespace}.js, services/{jobSplitter,scheduler,heartbeatMonitor,aggregator,aiInterpreter,baselineRunner}.js, middleware/{auth,error}.js.
Worker src: index.js, taskRunner.js, tasks/montecarloPi.js, sysinfo.js.

## Core behavior
1. Workers connect OUT to the coordinator on the Socket.IO "/workers" namespace, authenticating with a per-user workerToken. They emit worker:register {workerId, name, platform, cpuCores, totalRamMB, maxConcurrentTasks}, then worker:heartbeat {workerId, cpuLoad, freeRamMB, activeTasks, ts} every 3 seconds. workerId is a uuid persisted to a local file so reconnects keep identity.
2. Jobs: type MONTE_CARLO_PI with params {totalSamples, chunkSize}. jobSplitter creates Task documents, each with {samples, seed}. Seeds must be unique and deterministic (for example derived from jobId and task index). Use a seeded PRNG (mulberry32 or xorshift), never Math.random.
3. Scheduler: push-based. Assign pending tasks to online workers with activeTasks < maxConcurrentTasks, preferring the worker with the most free capacity. Re-run on: job created, task completed, worker joined, worker lost. Emit task:assign {taskId, jobId, attempt, type, params}.
4. Worker runs the task in a worker_thread (so heartbeats are never blocked), limited by MAX_CORES from env, then emits task:result {taskId, jobId, attempt, result:{inside,total,computeMs}} or task:error.
5. Aggregation: pi = 4 * sum(inside) / sum(total). Job completes when all tasks complete.
6. Fault tolerance: heartbeatMonitor runs every 3s; a worker with no heartbeat for 10s (or a socket disconnect) is marked offline and all its assigned/running tasks go back to pending with attempt+1 and a history entry. After maxAttempts (3) the task and job fail with a clear reason. Accept a result ONLY if the task is not already completed AND the attempt number matches the current attempt; ignore and log late/duplicate results. Validate 0 <= inside <= total and total === task samples. Enforce a per-task timeout on the coordinator.
7. Security: only whitelisted predefined task types ever run on workers. NEVER execute arbitrary or user-supplied code. Clamp totalSamples and chunkSize to safe ranges.
8. AI: POST /api/jobs/interpret takes {prompt} and calls Gemini asking for JSON only: {type, params:{totalSamples, chunkSize}, explanation}. Validate with zod, enforce the type whitelist, clamp values. If Gemini fails or returns invalid output, fall back to a regex parser that understands numbers like "500 million", "2b", "10k". The UI shows the config for user confirmation before the job starts. LLM output is never executed.
9. Benchmark: POST /api/jobs/:id/baseline runs the same Monte Carlo code for the same total samples on one machine and stores durationMs on the job. The UI shows a Recharts bar chart of baseline vs distributed time and the speedup.
10. Dashboard realtime: coordinator emits worker:update, job:update, task:update on the "/dashboard" namespace (JWT authenticated). The frontend uses Zustand stores and updates live without polling.

## Data models (Mongoose)
User {email, passwordHash, name, role, workerToken}
Worker {workerId, owner, name, platform, cpuCores, totalRamMB, status(online|busy|offline), socketId, lastHeartbeatAt, lastCpuLoad, lastFreeRamMB, maxConcurrentTasks, stats{tasksCompleted,totalComputeMs}}
Job {owner, type, params, rawPrompt, aiConfig, status(pending|running|completed|failed|cancelled), totalTasks, completedTasks, result{piEstimate,insideCount,totalCount,error}, timing{startedAt,finishedAt,durationMs}, baseline{durationMs,piEstimate}}
Task {job, index, type, params{samples,seed}, status(pending|assigned|running|completed|failed), assignedTo, attempt, maxAttempts, assignedAt, completedAt, result{inside,total,computeMs}, history[{worker,attempt,outcome,at}]}

## REST API
POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
GET /api/workers
POST /api/jobs/interpret, POST /api/jobs, GET /api/jobs, GET /api/jobs/:id, POST /api/jobs/:id/cancel, POST /api/jobs/:id/baseline

## Frontend pages
Login/Register, Dashboard (summary cards, live workers), Workers (table with cores, RAM, live CPU/RAM, status badge, tasks done), New Job (natural-language box, "Interpret" button, editable config preview, "Run" button), Job Detail (progress bar, per-task table showing worker and attempt, live partial Pi estimate, final result, baseline vs distributed chart, a "Run single-machine baseline" button), History. Clean modern Tailwind UI with a dark theme, responsive.

## Env (.env.example)
Coordinator: PORT, MONGODB_URI, JWT_SECRET, GEMINI_API_KEY, HEARTBEAT_INTERVAL_MS=3000, HEARTBEAT_TIMEOUT_MS=10000, TASK_TIMEOUT_MS, MAX_SAMPLES_PER_JOB, MAX_ATTEMPTS=3
Worker: COORDINATOR_URL, WORKER_TOKEN, WORKER_NAME, MAX_CORES, MAX_CONCURRENT_TASKS

## Out of scope for now (do not build)
Docker isolation, compute credits/rewards, P2P networking, ML-based scheduling, running arbitrary user code. Leave clean extension points and mention them in the README.

## Deliverables
Working code, README with setup and a step-by-step demo guide, scripts: "npm run dev:coordinator", "npm run dev:frontend", "npm run worker". Then wait for my approval of the plan before coding.
````

## 3.2 Phase Prompts

Paste each one after the previous phase passes its checks.

### Phase 1: Distributed foundation

````
Implement Phase 1 only: the distributed computing core, no frontend yet.
- Scaffold the monorepo, shared constants, coordinator, and worker-agent.
- Coordinator: Express + Socket.IO "/workers" namespace, Mongoose models Worker/Job/Task, jobSplitter, scheduler, aggregator.
- Worker agent: connects with a token, registers, heartbeats every 3s, runs montecarloPi in a worker_thread, returns results.
- A temporary script `npm run submit-job -- --samples 100000000 --chunk 5000000` that creates a job directly and prints live progress and the final Pi estimate.
- Unit tests: jobSplitter (task count, sample totals, unique seeds), montecarloPi (reproducible with same seed, estimate within tolerance), aggregator.
Acceptance: start the coordinator, start 3 workers on this machine (different WORKER_NAME values), run submit-job, see tasks spread across all 3 workers and a Pi estimate near 3.1416. Show me the terminal output as proof.
````

### Phase 2: Reliability

````
Implement Phase 2: fault tolerance.
- heartbeatMonitor with a 10s timeout and socket-disconnect handling.
- Requeue tasks of a lost worker with attempt+1 and history entries; maxAttempts=3 then fail the job with a reason.
- Duplicate/late-result protection using (taskId, attempt); result validation; per-task timeout.
- Worker reconnection with the same workerId.
- Tests: simulate a worker dying mid-task (kill the process), a late result arriving after reassignment, an invalid result, and all workers offline.
Acceptance: run a long job on 3 workers, kill one worker process mid-job, and show the job still completes with the correct sample total and no double counting. Show the task history proving the reassignment.
````

### Phase 3: MERN application

````
Implement Phase 3: auth, REST API, and the React dashboard.
- JWT auth (register/login/me), workerToken per user, auth middleware for REST and the "/dashboard" namespace.
- REST routes for workers and jobs (no AI yet: the New Job page uses a manual form for totalSamples and chunkSize).
- Coordinator emits worker:update, job:update, task:update to the dashboard namespace.
- Frontend (Vite + React + Tailwind + Zustand + Recharts): Login/Register, Dashboard, Workers, New Job (manual form), Job Detail with live progress bar, per-task table, partial Pi estimate, History.
- Baseline endpoint and the baseline-vs-distributed Recharts bar chart plus speedup figure.
Acceptance: using the browser, register, copy the worker token, start 2 workers, submit a job from the UI, watch live progress, kill a worker and see reassignment in the UI, then run the baseline and see the comparison chart. Capture screenshots or a recording as artifacts.
````

### Phase 4: AI integration

````
Implement Phase 4: Gemini natural-language job interpretation.
- services/aiInterpreter.js calling the Gemini API with JSON-only output, validated with zod, type whitelist, clamped values.
- Regex fallback parser for when Gemini is unavailable or returns invalid output.
- POST /api/jobs/interpret and a New Job UI: natural-language textarea, "Interpret" button, editable config preview with the AI explanation, then "Run".
- Store rawPrompt and aiConfig on the Job.
- Tests with the Gemini call mocked: valid JSON, invalid JSON, out-of-range values, unknown job type, API failure.
Acceptance: "Estimate pi using half a billion samples" yields totalSamples=500000000 in the preview. With the API key removed, the regex fallback still works and the UI says the fallback was used.
````

### Phase 5: Hackathon polish (do this before any advanced features)

````
Polish for a live demo.
- Seed/demo mode: a button or script that creates a demo user and a sample completed job in history.
- Make the UI clearly show worker activity (which task each worker is running), worker offline/online transitions, and reassignment events in an activity feed.
- Add a "local demo" script that starts the coordinator plus N workers on one machine for the fallback demo.
- Improve error states, loading states, empty states.
- Write the README demo guide that matches this script: show workers, NL job, AI config, live distribution, kill a worker, final result, baseline comparison.
- Run the whole flow once and report anything flaky.
````

### Phase 6: Advanced (only after the demo path is solid)

````
Add extension points, not full features:
- A Task type registry so new whitelisted workloads (image resize, CSV processing) can be added by dropping a module into worker-agent/src/tasks and registering its type in shared/constants.js.
- A scheduler interface so the rule-based scheduler can later be swapped for an ML-based one; log per-task computeMs per worker for future training data.
- Document, in the README, how Docker isolation, compute credits, and P2P (WebRTC/libp2p) would plug in.
Do not implement them yet.
````

## 3.3 Tips for working with the agent

- Make it **plan first** and review the plan. Fix scope there, it is cheapest.
- Insist on **proof** at each phase (terminal output, screenshots, recordings). Do not accept "it should work".
- Test on **two real machines** by Phase 2, not just localhost. Network issues are the biggest demo risk.
- Keep Phases 1 to 3 as the guaranteed demo. Treat Phase 4 as the wow factor, and Phases 5 and 6 as polish and future scope.
- After each phase, ask the agent to explain the files it wrote. You will be the one answering judges' questions.
