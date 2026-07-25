export async function analyzeFirmwareWithBackend(code) {
  if (!globalThis.fetch) {
    return unavailableDiagnostics('Fetch API indisponivel para analise de firmware.');
  }

  try {
    const response = await fetch('/api/firmware/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });

    if (!response.ok) {
      return unavailableDiagnostics(`Endpoint de firmware respondeu HTTP ${response.status}.`);
    }

    return response.json();
  } catch (error) {
    return unavailableDiagnostics(`Analise Clang indisponivel: ${error.message}`);
  }
}

export async function compileFirmwareWasmWithBackend(code, options = {}) {
  if (!globalThis.fetch) {
    return unavailableWasmDiagnostics('Fetch API indisponivel para compilacao WASM.');
  }

  try {
    const response = await fetch('/api/firmware/compile-wasm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code,
        constants: options.constants ?? {}
      })
    });

    if (!response.ok) {
      return unavailableWasmDiagnostics(`Endpoint WASM respondeu HTTP ${response.status}.`);
    }

    const job = await response.json();

    if (!job.jobId) {
      return job;
    }

    return await waitForWasmCompileJob(job.jobId, {
      minDelayMs: options.minDelayMs ?? 3000,
      pollIntervalMs: options.pollIntervalMs ?? 600
    });
  } catch (error) {
    return unavailableWasmDiagnostics(`Compilacao WASM indisponivel: ${error.message}`);
  }
}

async function waitForWasmCompileJob(jobId, { minDelayMs, pollIntervalMs }) {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let polling = false;
    let settled = false;
    let interval = null;

    const settle = (result) => {
      if (settled) {
        return;
      }

      settled = true;

      if (interval) {
        globalThis.clearInterval(interval);
      }

      resolve(result);
    };

    const poll = async () => {
      if (polling || settled) {
        return false;
      }

      polling = true;

      try {
        const response = await fetch(`/api/firmware/compile-wasm/${encodeURIComponent(jobId)}`);

        if (!response.ok) {
          settle(unavailableWasmDiagnostics(`Status da compilacao WASM respondeu HTTP ${response.status}.`));
          return true;
        }

        const job = await response.json();

        if (job.status === 'done' || job.status === 'failed') {
          const elapsedMs = Date.now() - startedAt;
          const remainingMs = Math.max(0, minDelayMs - elapsedMs);

          globalThis.setTimeout(() => {
            settle(job.result ?? unavailableWasmDiagnostics('Compilacao WASM terminou sem resultado.'));
          }, remainingMs);
          return true;
        }

        if (job.status === 'missing') {
          settle(unavailableWasmDiagnostics('Job de compilacao WASM nao encontrado.'));
          return true;
        }
      } catch (error) {
        settle(unavailableWasmDiagnostics(`Status da compilacao WASM indisponivel: ${error.message}`));
        return true;
      } finally {
        polling = false;
      }

      return false;
    };

    interval = globalThis.setInterval(async () => {
      if (await poll()) {
        globalThis.clearInterval(interval);
      }
    }, pollIntervalMs);

    poll().then((done) => {
      if (done) {
        globalThis.clearInterval(interval);
      }
    });
  });
}

function unavailableDiagnostics(message) {
  return {
    available: false,
    diagnostics: [
      {
        source: 'clang',
        severity: 'warning',
        code: 'CLANG_UNAVAILABLE',
        message
      }
    ]
  };
}

function unavailableWasmDiagnostics(message) {
  return {
    available: false,
    ok: false,
    diagnostics: [
      {
        source: 'clang-wasm',
        severity: 'warning',
        code: 'WASM_TOOLCHAIN_UNAVAILABLE',
        message
      }
    ],
    wasmBase64: null
  };
}
