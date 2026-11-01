MeshCompute AI
One Job. Multiple Machines. Shared Computing Power.

MeshCompute AI turns idle personal computers into a collaborative compute cluster. It splits supported computational workloads into smaller tasks, distributes them across connected machines, and combines their results through a central coordinator.

<p align="center">
  <strong>HackCBS 9.0 · Open Innovation</strong>
</p>The Problem
Computers around us often have CPU cores sitting idle while other users are waiting for resource-intensive computations to finish. At the same time, scaling a workload with cloud infrastructure can introduce cost, setup complexity, and dependency on rented compute.

MeshCompute AI explores a different approach: use the spare computing capacity that already exists across participating computers.

Instead of requiring every user to buy more hardware, multiple machines can contribute their available CPU resources to a shared pool and work on suitable parallelizable jobs together.
Our Solution
MeshCompute AI is a distributed computing platform with two sides:
- Resource consumers submit a supported computation through a web dashboard, either by configuring it or describing it in natural language.
- Resource providers run a lightweight Worker Agent that connects to the coordinator and contributes spare compute capacity.
The coordinator validates and splits a job into smaller tasks, schedules those tasks across available workers, monitors their health, retries interrupted work, and aggregates the results.

An AI-assisted job compiler can translate a natural-language request into a structured job configuration. The generated configuration is validated against supported task schemas before execution.
How It Works
                 ┌──────────────────────────┐
                 │     React Dashboard      │
                 │ Submit jobs & monitor    │
                 └────────────┬─────────────┘
                              │ REST API + Socket.IO
                              ▼
                 ┌──────────────────────────┐
                 │        Coordinator       │
                 │                          │
                 │  Job validation/splitting│
                 │  Task scheduling         │
                 │  Heartbeat monitoring    │
                 │  Retry & result handling │
                 └───────┬──────────┬───────┘
                         │          │
                  Socket.IO       MongoDB
                   /workers     jobs, tasks,
                         │       users, workers
             ┌───────────┼───────────┐
             ▼           ▼           ▼
        ┌─────────┐ ┌─────────┐ ┌─────────┐
        │ Worker  │ │ Worker  │ │ Worker  │
        │   A     │ │   B     │ │   C     │
        └─────────┘ └─────────┘ └─────────┘
             Each worker executes approved task types
             and reports results and system heartbeats.
Execution flow
1. A user submits a job from the dashboard.
2. The coordinator validates the job configuration.
3. The job splitter creates independent tasks from the workload.
4. The scheduler assigns pending tasks to connected workers.
5. Worker Agents execute the assigned task using the local machine's CPU.
6. Workers send task results and periodic health updates to the coordinator.
7. The coordinator accepts valid results, retries eligible failed or interrupted tasks, and aggregates the completed output.
8. The dashboard receives live status updates.
Supported Demonstration Workloads
The current MVP includes a whitelisted task registry. Workers do not execute arbitrary user-submitted code.
Workload	What it demonstrates
Monte Carlo Pi Estimation	A large simulation split into independent sample batches. Partial counts are combined to estimate π.
Matrix Multiplication	Matrix row ranges are partitioned into tasks and computed by different workers to produce the resulting matrix.


The natural-language compiler currently supports these workload types. If the Gemini API key is not configured or the API is unavailable, the application can use its rule-based fallback parser.
Scope note: This is a hackathon MVP for supported, parallelizable workloads. It is not a general-purpose cloud replacement, and distributed execution is not automatically faster for every job. Network overhead, task size, worker hardware, and coordination costs all affect performance.

Key Features
- Distributed task execution: Divide supported jobs into smaller units and run them across multiple connected computers.
- Live worker monitoring: View connected workers, CPU/RAM information, active tasks, and heartbeat-driven status.
- AI-assisted job configuration: Convert natural-language requests into validated job parameters, with a fallback parser.
- Task scheduling: Assign work to available workers based on their reported capacity and current load.
- Fault detection and retries: Detect disconnected or unresponsive workers and make eligible unfinished tasks available for retry.
- Result aggregation: Combine partial task outputs into a final job result.
- Benchmark comparison: Compare a coordinator's single-machine baseline with the distributed run for supported workloads.
- Task safety boundary: Worker Agents execute only task handlers registered in the codebase.
Technology Stack
Layer	Technologies
Frontend	React, Vite, Tailwind CSS, Zustand, Recharts, Lucide
Backend	Node.js, Express
Real-time communication	Socket.IO
Database	MongoDB, Mongoose
AI integration	Google Gemini API
Validation	Zod
Parallel execution	Node.js worker_threads
Shared contracts	Local meshcompute-shared workspace package


Repository Structure
MeshCompute/
├── coordinator/             # API, scheduler, sockets, models and services
│   └── src/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── scripts/
│       ├── services/
│       └── sockets/
├── frontend/                # React dashboard
│   └── src/
│       ├── components/
│       ├── lib/
│       ├── pages/
│       └── store/
├── worker-agent/            # Installable compute worker
│   └── src/
│       ├── tasks/
│       ├── index.js
│       ├── sysinfo.js
│       ├── taskRunner.js
│       └── workerThread.js
├── shared/                  # Shared task types, events and limits
├── scripts/                 # Demo and seed scripts
├── .env.example
└── README.md
Getting Started
Prerequisites
- Node.js 20 or later
- npm 9 or later
- MongoDB instance (local or hosted)
- Gemini API key (optional; the rule-based parser can be used without it)
1. Clone the repository
git clone <YOUR_REPOSITORY_URL>
cd hackCBS9.0-main
2. Install dependencies
Run this from the repository root:
npm install
The project uses npm workspaces, so this installs dependencies for the frontend, coordinator, worker agent, and shared package.
3. Configure environment variables
Copy the example file:
cp .env.example .env
On Windows Command Prompt:
copy .env.example .env
Update .env:
# Coordinator
PORT=4000
MONGODB_URI=mongodb://localhost:27017/meshcompute
JWT_SECRET=replace-with-a-long-random-secret
GEMINI_API_KEY=your-gemini-api-key

# Worker
COORDINATOR_URL=http://localhost:4000
WORKER_TOKEN=meshcompute-demo-worker-token
WORKER_NAME=worker-1
MAX_CONCURRENT_TASKS=4
GEMINI_API_KEY is optional. Without it, natural-language job requests use the fallback parser.

For a hosted MongoDB database, replace MONGODB_URI with your MongoDB connection string.
4. Start the demo
npm run demo
The demo script attempts to seed a demo account and sample completed job, then starts the coordinator, one local worker, and the frontend.

Open:
- Dashboard: http://localhost:5173
- Coordinator health check: http://localhost:4000/health
Demo login:
Email:    demo@meshcompute.ai
Password: password123
The demo worker token is:
meshcompute-demo-worker-token
If the demo script cannot connect to MongoDB, the database must be started or the .env connection string corrected before the coordinator can run.
Connect More Computers
The central idea is that worker machines connect outbound to the coordinator. They do not need to accept inbound connections from other workers.
1. Make the coordinator reachable
For computers on the same LAN, use the coordinator machine's private LAN IP address, for example:
http://192.168.1.10:4000
Make sure the coordinator machine's firewall allows incoming connections to the coordinator port from the worker machines.

For computers outside the LAN, the coordinator needs a reachable HTTPS/WSS endpoint. Configure your deployment or secure tunnel accordingly. Do not expose a development server with default secrets to the public internet.
2. Start a worker on another computer
Clone the repository on the worker computer and install dependencies:
npm install
Set the coordinator URL and worker credentials in that machine's environment:
COORDINATOR_URL=http://192.168.1.10:4000
WORKER_TOKEN=meshcompute-demo-worker-token
WORKER_NAME=worker-laptop-2
MAX_CONCURRENT_TASKS=4
Then run:
npm run worker
Repeat with a unique WORKER_NAME for each additional computer.

The worker token must be valid for the coordinator's worker authentication configuration. The demo token above is for the seeded demo setup only; use properly managed credentials for any non-demo deployment.
3. Verify the cluster
Open the dashboard's Workers view. Connected agents should register and report machine information and periodic heartbeat metrics. Submit a supported job to see task allocation and progress.
Important: For remote workers, COORDINATOR_URL must point to the reachable coordinator host, not localhost. On a remote machine, localhost refers to that worker itself.

Run Services Individually
You can start each service separately from the repository root:
# Backend coordinator
npm run dev:coordinator

# Frontend dashboard
npm run dev:frontend

# Worker agent
npm run worker
The frontend uses these optional Vite variables:
VITE_API_URL=http://localhost:4000/api
VITE_COORDINATOR_URL=http://localhost:4000
For a deployed frontend, set both variables to the deployed coordinator's public URL before building the frontend.
Tests and Build
Run the coordinator test suite:
npm test
Run worker-agent tests:
npm -w worker-agent test
Build the frontend:
npm -w frontend run build
Security and Reliability
The MVP includes several safeguards:
- Whitelisted task handlers: Workers resolve task types through a local registry rather than evaluating arbitrary user code.
- Schema validation: Job configurations are validated before task creation.
- Worker authentication: Worker connections are authenticated using a token.
- Heartbeats: Workers periodically report liveness and resource metrics.
- Retry handling: Eligible interrupted tasks can be reassigned, subject to retry limits.
- Attempt-aware result handling: Results are associated with task attempts to help reject stale or duplicate completions.
- Worker-thread execution: CPU-intensive task handlers run in worker threads so the agent's main event loop can continue handling communication.
Before production use
This repository is a hackathon prototype, not a production-hardened compute marketplace. A production deployment would need, at minimum:
- Strict CORS and origin allowlists.
- Strong secret and token rotation, plus per-worker credentials.
- TLS for all public traffic.
- Stronger isolation and resource quotas for worker processes.
- Explicit contributor consent, workload transparency, and privacy controls.
- More comprehensive input limits, abuse prevention, observability, and recovery testing.
- Independent verification strategies for untrusted or non-deterministic workloads.
Current Limitations
- Only the task types implemented in the worker registry are executable.
- The coordinator is a central dependency; this is not yet a peer-to-peer network.
- Worker availability and speed depend on the contributor's machine, power state, and network connection.
- Communication and scheduling overhead can outweigh parallel-compute gains for small workloads.
- The AI compiler assists with job configuration; it does not generate or execute arbitrary programs.
- The current benchmark is workload- and hardware-dependent. Results should be measured on the actual machines used in a demo.
Future Scope
- Add more safe, independently parallelizable workloads such as batch image processing and data transformations.
- Improve scheduling using historical worker performance and live resource availability.
- Add stronger sandboxing, per-worker quotas, and contributor controls.
- Explore peer-to-peer worker discovery and transport.
- Introduce verifiable compute and transparent contribution accounting.