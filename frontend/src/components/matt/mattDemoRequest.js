const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "";

export function createMattDemoRequest({ fetchFn = fetch, baseUrl = API_BASE_URL } = {}) {
  const sessionCredentials = new Map();
  async function send(path, { method = "GET", body, signal, keepalive = false } = {}, token) {
    const response = await fetchFn(`${baseUrl}/api/demo/matt${path}`, {
      method, credentials: "omit", signal, keepalive,
      headers: { "Content-Type": "application/json", ...(token ? { "X-Matt-Demo-Token": token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload?.error || `Demo Matt request failed (${response.status}).`);
      error.status = response.status; error.payload = payload;
      throw error;
    }
    return payload;
  }
  return async (path, options = {}) => {
    if (path === "/status") return send(path, options);
    if (path === "/sessions" && options.method === "POST") {
      const credential = await send("/access", { method: "POST", body: { consent: options.body?.consent === true } });
      if (typeof credential?.token !== "string" || !credential.expiresAt) throw new Error("Demo session authorization is invalid.");
      const token = credential.token;
      const result = await send(path, options, token);
      if (!result?.id) throw new Error("Demo session creation returned no identifier.");
      sessionCredentials.set(result.id, token);
      return result;
    }
    const id = path.match(/^\/sessions\/([^/?]+)/)?.[1];
    const token = sessionCredentials.get(id);
    if (!token) throw new Error("No authorized Demo session exists for this request.");
    const result = await send(path, options, token);
    if (options.method === "DELETE" && path === `/sessions/${id}`) sessionCredentials.delete(id);
    return result;
  };
}
