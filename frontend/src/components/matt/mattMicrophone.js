export function supportsMattCapturedSpeech(environment = window) {
  // Unsupported engines can silently ignore this optional WebIDL argument.
  const agent = environment.navigator?.userAgent || "";
  const version = /(?:Chrome|Chromium)\/(\d+)/.exec(agent);
  return Boolean((environment.SpeechRecognition || environment.webkitSpeechRecognition)
    && version && Number(version[1]) >= 135 && !/Android|iPhone|iPad|iPod/.test(agent));
}

export function createMattMicrophone({ environment = window, onState, onError, onRevoked }) {
  let stream = null, pending = null, revision = 0, disposed = false, permission = null;
  const publish = (state) => { if (!disposed) onState(state); };
  function release() {
    revision++;
    stream?.getTracks().forEach((track) => { track.removeEventListener("ended", revoked); track.stop(); });
    stream = null;
  }
  function fail(state, message) {
    publish(state);
    if (!disposed) onError(message);
  }
  function revoked() {
    release();
    fail("REVOKED", "Microphone access was revoked or the device disconnected. Enable it in browser site permissions and device privacy settings, then retry.");
    onRevoked();
  }
  async function observePermission() {
    if (!environment.navigator.permissions?.query || permission) return;
    try {
      const result = await environment.navigator.permissions.query({ name: "microphone" });
      if (disposed || permission) return;
      permission = result;
      permission.addEventListener("change", permissionChanged);
    } catch (error) {
      console.warn("Matt microphone permission status is unavailable; device capture remains authoritative", error.name);
    }
  }
  function permissionChanged() { if (permission.state === "denied" && stream) revoked(); }
  return {
    acquire() {
      if (disposed) return Promise.resolve(null);
      if (!environment.isSecureContext || !environment.navigator?.mediaDevices?.getUserMedia || !supportsMattCapturedSpeech(environment)) {
        fail("UNSUPPORTED", "Captured-track speech requires desktop Chrome or Edge 135+ over HTTPS (or localhost). This browser cannot connect the captured microphone to recognition. Use typed questions.");
        return Promise.resolve(null);
      }
      const existing = stream?.getAudioTracks().find((track) => track.readyState === "live");
      if (existing) { existing.enabled = true; return Promise.resolve(existing); }
      if (pending) return pending;
      const ownRevision = revision;
      publish("REQUESTING");
      // Start device permission directly in the click path, before any network/session await.
      const capture = environment.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      void observePermission();
      pending = capture.then((next) => {
        if (disposed || ownRevision !== revision) { next.getTracks().forEach((track) => track.stop()); return null; }
        const track = next.getAudioTracks().find((item) => item.readyState === "live");
        if (!track) { next.getTracks().forEach((item) => item.stop()); throw new DOMException("No microphone was detected.", "NotFoundError"); }
        stream = next;
        track.addEventListener("ended", revoked, { once: true });
        publish("GRANTED");
        return track;
      }).catch((error) => {
        if (disposed || ownRevision !== revision) return null;
        const messages = {
          NotAllowedError: ["DENIED", "Microphone permission is required. Allow microphone access in browser site permissions and device privacy settings, then click Microphone to retry."],
          SecurityError: ["DENIED", "Microphone access is blocked by browser policy. Check site permissions and device privacy settings, then retry."],
          NotFoundError: ["DEVICE_NOT_FOUND", "No microphone was detected. Connect or enable a microphone, then retry."],
          NotReadableError: ["DEVICE_BUSY", "The microphone could not be opened. Another application or device error may be using it. Close other capture applications and retry."],
          AbortError: ["DEVICE_BUSY", "Microphone capture was interrupted by the device. Check other applications and retry."],
        };
        const [state, message] = messages[error.name] || ["ERROR", `Microphone capture failed (${error.name || "unknown error"}). Check the device and retry.`];
        fail(state, message);
        return null;
      }).finally(() => { pending = null; });
      return pending;
    },
    pause() { stream?.getAudioTracks().forEach((track) => { track.enabled = false; }); },
    disable() { release(); },
    dispose() {
      release();
      disposed = true;
      permission?.removeEventListener("change", permissionChanged);
    },
  };
}
