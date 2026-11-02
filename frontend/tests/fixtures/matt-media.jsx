import React from "react";
import { createRoot } from "react-dom/client";
import MattEnvironment from "../../src/components/matt/MattEnvironment.jsx";

window.__media = { statuses: [], errors: [] };
const root = createRoot(document.getElementById("root"));
const onMediaStatus = (status) => window.__media.statuses.push(status);
const onMediaError = (error) => window.__media.errors.push(error);
window.renderMatt = (stream) => root.render(<MattEnvironment phase="IDLE" stream={stream} onMediaStatus={onMediaStatus} onMediaError={onMediaError}/>);
window.unmountMatt = () => root.unmount();
document.getElementById("start").onclick = async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 480;
  const context = canvas.getContext("2d");
  context.fillStyle = "#0066d9"; context.fillRect(0, 0, canvas.width, canvas.height);
  const audio = new AudioContext();
  await audio.resume();
  const oscillator = audio.createOscillator(), destination = audio.createMediaStreamDestination();
  oscillator.connect(destination); oscillator.start();
  const stream = new MediaStream([...canvas.captureStream(10).getTracks(), ...destination.stream.getAudioTracks()]);
  const tracks = stream.getTracks();
  window.__testStream = stream;
  window.__stopMedia = async () => { tracks.forEach((track) => track.stop()); oscillator.stop(); await audio.close(); };
  window.renderMatt(stream);
};
