export async function apiRequest({
  apiBaseUrl,
  path,
  method = "GET",
  token,
  body,
  isForm = false,
}) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let requestBody;
  if (body !== undefined && body !== null) {
    if (isForm) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      requestBody = new URLSearchParams(body);
    } else {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(body);
    }
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: requestBody,
  });

  const raw = await response.text();
  let data = raw;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    const detail = data?.detail || data || response.statusText;
    throw new Error(`${response.status}: ${detail}`);
  }

  return data;
}
