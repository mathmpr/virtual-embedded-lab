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

    return response.json();
  } catch (error) {
    return unavailableWasmDiagnostics(`Compilacao WASM indisponivel: ${error.message}`);
  }
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
