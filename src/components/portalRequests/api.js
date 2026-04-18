export function endpoint(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export async function parseErrorResponse(res) {
  const detail = `HTTP ${res.status}`;
  try {
    await res.json();
  } catch {
    // best effort parse
  }
  return detail;
}

