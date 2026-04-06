export function endpoint(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export async function parseErrorResponse(res) {
  let detail = `HTTP ${res.status}`;
  try {
    const payload = await res.json();
    if (payload && typeof payload.error === 'string') {
      detail = `${detail} (${payload.error})`;
    }
  } catch {
    // best effort parse
  }
  return detail;
}

