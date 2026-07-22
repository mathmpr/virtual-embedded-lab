export async function loadExampleList(fetchImpl = fetch) {
  const response = await fetchImpl('/api/examples');

  if (!response.ok) {
    throw new Error(`Falha ao carregar exemplos: HTTP ${response.status}`);
  }

  const catalog = await response.json();
  return catalog.examples ?? [];
}

export async function loadExampleProject(exampleId, fetchImpl = fetch) {
  const response = await fetchImpl(`/api/examples/${encodeURIComponent(exampleId)}`);

  if (!response.ok) {
    throw new Error(`Falha ao carregar exemplo: HTTP ${response.status}`);
  }

  return response.json();
}
