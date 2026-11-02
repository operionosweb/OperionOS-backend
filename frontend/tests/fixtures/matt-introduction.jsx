import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import MattEnvironment from "../../src/components/matt/MattEnvironment.jsx";
import "../../src/styles/matt.css";

window.__intro = { completed: 0, errors: [], statuses: [] };
const onMediaError = (error) => window.__intro.errors.push(error);
const onMediaStatus = (status) => window.__intro.statuses.push(status);
function Fixture() {
  const [context, setContext] = useState("contract-one");
  const [mounted, setMounted] = useState(true);
  const [stream, setStream] = useState(null);
  const [identity, setIdentity] = useState("fixture");
  const complete = useCallback(() => {
    window.__intro.completed++;
    if (window.__mountSyntheticLive) {
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 480;
      canvas.getContext("2d").fillRect(0, 0, 640, 480);
      const audio = new AudioContext(), oscillator = audio.createOscillator(), destination = audio.createMediaStreamDestination();
      oscillator.connect(destination); oscillator.start();
      const media = new MediaStream([...canvas.captureStream(10).getTracks(), ...destination.stream.getAudioTracks()]);
      window.__cleanupSynthetic = () => { media.getTracks().forEach((track) => track.stop()); oscillator.stop(); return audio.close(); };
      setStream(media);
    }
  }, []);
  return <main className="matt-page">
    <button onClick={() => setContext((value) => value === "contract-one" ? "flight-two" : "contract-one")}>Change context</button>
    <button onClick={() => setMounted((value) => !value)}>Toggle Matt</button>
    <button onClick={() => setIdentity((value) => value === "fixture" ? "other-user" : "fixture")}>Switch authorized user</button>
    <p>{context}</p>
    {mounted && <MattEnvironment phase="READY" introductionKey={identity} onIntroductionComplete={complete} onMediaError={onMediaError} onMediaStatus={onMediaStatus} stream={stream}/>}
  </main>;
}
createRoot(document.getElementById("root")).render(<Fixture/>);
