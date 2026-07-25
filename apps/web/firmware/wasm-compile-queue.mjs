import { randomUUID } from 'node:crypto';
import { compileFirmwareWasmWithClang } from './wasm-compiler.mjs';

const maxConcurrentCompiles = 2;
const jobTtlMs = 10 * 60 * 1000;
const jobs = new Map();
const pendingJobIds = [];
let runningCompiles = 0;

export function enqueueFirmwareWasmCompile({ code, constants = {} }) {
  cleanupOldJobs();

  const job = {
    id: randomUUID(),
    status: 'queued',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    code,
    constants,
    result: null
  };

  jobs.set(job.id, job);
  pendingJobIds.push(job.id);
  drainCompileQueue();

  return publicJob(job);
}

export function getFirmwareWasmCompileJob(jobId) {
  cleanupOldJobs();
  const job = jobs.get(jobId);

  if (!job) {
    return null;
  }

  return publicJob(job);
}

export function compileQueueStats() {
  cleanupOldJobs();

  return {
    queued: pendingJobIds.length,
    running: runningCompiles,
    maxConcurrent: maxConcurrentCompiles
  };
}

export function _resetFirmwareWasmCompileQueueForTests() {
  jobs.clear();
  pendingJobIds.length = 0;
  runningCompiles = 0;
}

function drainCompileQueue() {
  while (runningCompiles < maxConcurrentCompiles && pendingJobIds.length > 0) {
    const jobId = pendingJobIds.shift();
    const job = jobs.get(jobId);

    if (!job || job.status !== 'queued') {
      continue;
    }

    runJob(job);
  }
}

async function runJob(job) {
  runningCompiles += 1;
  job.status = 'running';
  job.startedAt = Date.now();
  job.updatedAt = job.startedAt;

  try {
    job.result = await compileFirmwareWasmWithClang(job.code, {
      constants: job.constants
    });
    job.status = 'done';
  } catch (error) {
    job.status = 'failed';
    job.result = {
      available: false,
      ok: false,
      wasmBase64: null,
      diagnostics: [
        {
          source: 'clang-wasm',
          severity: 'error',
          code: 'FIRMWARE_WASM_COMPILE_FAILED',
          message: error.message
        }
      ]
    };
  } finally {
    job.finishedAt = Date.now();
    job.updatedAt = job.finishedAt;
    job.code = '';
    job.constants = {};
    runningCompiles = Math.max(0, runningCompiles - 1);
    drainCompileQueue();
  }
}

function publicJob(job) {
  const queuePosition = job.status === 'queued'
    ? pendingJobIds.indexOf(job.id) + 1
    : 0;

  return {
    jobId: job.id,
    status: job.status,
    queuePosition,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    result: job.status === 'done' || job.status === 'failed' ? job.result : null,
    stats: compileQueueStatsWithoutCleanup()
  };
}

function cleanupOldJobs() {
  const now = Date.now();

  for (const [jobId, job] of jobs.entries()) {
    const terminal = job.status === 'done' || job.status === 'failed';

    if (terminal && now - job.updatedAt > jobTtlMs) {
      jobs.delete(jobId);
    }
  }
}

function compileQueueStatsWithoutCleanup() {
  return {
    queued: pendingJobIds.length,
    running: runningCompiles,
    maxConcurrent: maxConcurrentCompiles
  };
}
