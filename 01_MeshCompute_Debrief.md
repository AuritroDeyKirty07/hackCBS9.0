# MeshCompute AI: Project Debrief

**Tagline:** One Job. Multiple Machines. Shared Computing Power.

This document has three parts:

1. **Debrief:** what the project is and why it exists
2. **System design:** architecture, data models, protocol, fault tolerance
3. **Antigravity build prompt:** copy-paste prompts to have an AI coding agent build it phase by phase

---

# Part 1: Debrief

## 1.1 One-paragraph summary

MeshCompute AI connects multiple computers into a shared compute network. A **Resource Provider** installs a lightweight **Worker Agent** and lends spare CPU and RAM. A **Resource Consumer** submits a job (for example "estimate Pi using 500 million samples"). A central **Coordinator** splits the job into small independent tasks, sends them to available workers, collects partial results, and combines them into the final answer. An LLM (Gemini) turns plain-English requests into a structured, validated job configuration.

## 1.2 Problem and opportunity

- Personal computers sit mostly idle; their CPU and RAM are wasted.
- Large batch workloads take a long time on one machine.
- Cloud compute costs money, even for simple batch jobs.
- A community pool of spare compute is a cheaper alternative for suitable workloads.

## 1.3 Who uses it

| Role | What they do |
|---|---|
| Resource Provider | Runs the Worker Agent, contributes CPU/RAM, sees their worker's activity |
| Resource Consumer | Logs into the dashboard, submits jobs, tracks progress, views results and history |

## 1.4 What makes it a good hackathon project

- It is **demonstrable live**: several laptops, real speedup numbers, a worker killed mid-job and the job still finishes.
- It covers a full stack: real-time systems, distributed-systems ideas (scheduling, heartbeats, retries, idempotency), a React dashboard, and an LLM integration.
- The MVP scope is small and honest: predefined trusted workloads only, rule-based scheduling, a central coordinator.

## 1.4.1 Scope decisions (important)

| In MVP | Deferred |
|---|---|
| Monte Carlo Pi workload | Image resize, CSV processing, batch inference |
| Rule-based scheduling | ML-based predictive scheduling |
| Central coordinator | P2P (WebRTC / libp2p) |
| Trusted predefined task types | Running arbitrary user code |
| Process-level limits (thread count, timeouts) | Docker isolation, credits and rewards |

**Rule:** never execute arbitrary user-submitted code on a contributor's machine in the MVP. Workers only run task types from a hard-coded whitelist.

## 1.5 Core objective

Build a functional distributed computing network first. Then add AI intelligence and decentralization on top.

---
