// === Task Types (whitelist) ===
export const TASK_TYPES = {
  MONTE_CARLO_PI: 'MONTE_CARLO_PI',
};

// === Statuses ===
export const WORKER_STATUS = {
  ONLINE: 'online',
  BUSY: 'busy',
  OFFLINE: 'offline',
};

export const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export const TASK_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

// === Socket Events: Worker <-> Coordinator ===
export const WS_EVENTS = {
  WORKER_REGISTER:   'worker:register',
  WORKER_REGISTERED: 'worker:registered',
  WORKER_HEARTBEAT:  'worker:heartbeat',
  TASK_ASSIGN:       'task:assign',
  TASK_STARTED:      'task:started',
  TASK_RESULT:       'task:result',
  TASK_ERROR:        'task:error',
  TASK_CANCEL:       'task:cancel',
};

// === Socket Events: Coordinator -> Dashboard ===
export const DASH_EVENTS = {
  WORKER_UPDATE: 'worker:update',
  JOB_UPDATE:    'job:update',
  TASK_UPDATE:   'task:update',
};

// === Limits ===
export const LIMITS = {
  MAX_SAMPLES_PER_JOB:  2_000_000_000,
  MAX_CHUNK_SIZE:        50_000_000,
  MIN_CHUNK_SIZE:        10_000,
  DEFAULT_CHUNK_SIZE:    5_000_000,
  MAX_ATTEMPTS:          3,
  HEARTBEAT_INTERVAL_MS: 3000,
  HEARTBEAT_TIMEOUT_MS:  10000,
  TASK_TIMEOUT_MS:       60000,
};
