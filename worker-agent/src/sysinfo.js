import os from 'os';

let previousCpus = os.cpus();

/**
 * Calculates CPU usage percentage across all cores since the last measurement.
 */
function getCpuLoadPercentage() {
  const currentCpus = os.cpus();
  let idleDifference = 0;
  let totalDifference = 0;

  for (let i = 0; i < currentCpus.length; i++) {
    const prev = previousCpus[i]?.times || { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 };
    const curr = currentCpus[i].times;

    const prevTotal = Object.values(prev).reduce((a, b) => a + b, 0);
    const currTotal = Object.values(curr).reduce((a, b) => a + b, 0);

    idleDifference += curr.idle - prev.idle;
    totalDifference += currTotal - prevTotal;
  }

  previousCpus = currentCpus;

  if (totalDifference === 0) return 0;
  const load = 100 - (idleDifference / totalDifference) * 100;
  return Math.min(100, Math.max(0, Math.round(load)));
}

export function getSystemInfo() {
  return {
    platform: `${os.platform()} (${os.arch()})`,
    cpuCores: os.cpus().length,
    totalRamMB: Math.round(os.totalmem() / (1024 * 1024)),
  };
}

export function getDynamicMetrics() {
  return {
    cpuLoad: getCpuLoadPercentage(),
    freeRamMB: Math.round(os.freemem() / (1024 * 1024)),
  };
}
