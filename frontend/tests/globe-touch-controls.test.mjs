import assert from "node:assert/strict";
import { test } from "node:test";
import { attachGlobeTouchControls } from "../src/components/aviation/globeTouchControls.js";

test("one-finger drag and pinch are separate; transitions, taps, cancellation, mouse and cleanup are preserved", () => {
  const listeners = new Map(), moves = [], taps = [];
  const captured = new Set();
  const canvas = {
    style: { touchAction: "auto" }, dataset: {}, clientWidth: 400, clientHeight: 500,
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name) => listeners.delete(name),
    setPointerCapture: (id) => captured.add(id), hasPointerCapture: (id) => captured.has(id),
    releasePointerCapture: (id) => captured.delete(id),
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
  };
  let flightsCancelled = 0;
  const camera = { positionCartographic: { height: 8000000 }, cancelFlight: () => flightsCancelled++ };
  for (const method of ["rotateLeft", "rotateUp", "moveRight", "moveUp", "zoomIn", "twistRight"]) camera[method] = (amount) => moves.push([method, amount]);
  const viewer = { canvas, camera, scene: { mode: 3, requestRender: () => moves.push(["render"]) } };
  const cleanup = attachGlobeTouchControls(viewer, (position) => taps.push(position));
  const send = (type, id, x, y, pointerType = "touch") => listeners.get(type)({
    type, pointerId: id, clientX: x, clientY: y, pointerType, timeStamp: 10, cancelable: true,
    stopImmediatePropagation() {}, preventDefault() {},
  });
  send("pointerdown", 1, 50, 50); send("pointermove", 1, 70, 50); send("pointerup", 1, 70, 50);
  assert.ok(moves.some(([method, amount]) => method === "rotateLeft" && amount > 0)); assert.deepEqual(taps, []);
  assert.equal(flightsCancelled, 1);
  const afterRelease = moves.length;
  send("pointermove", 1, 200, 200);
  assert.equal(moves.length, afterRelease, "Released fingers cannot move the camera");
  moves.length = 0;
  send("pointerdown", 1, 50, 50); send("pointerdown", 2, 100, 50); send("pointermove", 2, 130, 70);
  assert.ok(moves.some(([method, amount]) => method === "zoomIn" && amount > 0));
  assert.ok(!moves.some(([method]) => ["rotateLeft", "rotateUp", "twistRight", "moveRight", "moveUp"].includes(method)), "Pinch cannot also rotate, roll or pan");
  assert.ok(moves.find(([method]) => method === "zoomIn")[1] <= 1600000, "A large pinch event is bounded");
  send("pointerup", 2, 130, 70);
  const beforeResume = moves.length;
  send("pointermove", 1, 60, 50);
  assert.ok(moves.length > beforeResume, "Remaining finger resumes drag from its own position");
  assert.ok(Math.abs(moves.findLast(([method]) => method === "rotateLeft")[1]) < .1, "Finger count transitions cannot jump");
  send("pointercancel", 1, 50, 50); send("pointercancel", 2, 130, 70);
  assert.equal(taps.length, 0);
  send("pointerdown", 1, 50, 50); send("pointerup", 1, 50, 50);
  assert.deepEqual({ ...taps[0] }, { x: 40, y: 30 });
  send("pointerdown", 1, 50, 50); send("pointermove", 1, 100, 50); send("pointermove", 1, 50, 50); send("pointerup", 1, 50, 50);
  assert.equal(taps.length, 1, "A drag returning to its origin is not a marker tap");
  send("pointerdown", 1, 50, 50); send("pointerup", 1, 90, 50);
  assert.equal(taps.length, 1, "Missing move events cannot turn a displaced release into a tap");
  const count = moves.length;
  send("pointerdown", 3, 0, 0, "mouse"); send("pointermove", 3, 100, 100, "mouse");
  assert.equal(moves.length, count);
  viewer.scene.mode = 2;
  send("pointerdown", 1, 50, 50); send("pointermove", 1, 80, 70);
  assert.ok(moves.some(([method, amount]) => method === "moveRight" && amount < 0));
  assert.ok(moves.some(([method, amount]) => method === "moveUp" && amount > 0));
  send("pointercancel", 1, 50, 50); send("pointercancel", 2, 130, 70);
  moves.length = 0;
  send("pointerdown", 1, 50, 50); send("pointerdown", 2, 100, 50); send("pointerdown", 3, 150, 50); send("pointermove", 3, 180, 50);
  assert.equal(moves.length, 0, "Extra fingers suspend navigation until a valid gesture resumes");
  send("pointercancel", 3, 180, 50); send("pointercancel", 2, 100, 50); send("pointercancel", 1, 50, 50);
  viewer.scene.mode = 0;
  const beforeMorph = moves.length;
  send("pointerdown", 1, 50, 50); send("pointerdown", 2, 100, 50); send("pointermove", 2, 130, 70);
  assert.equal(moves.length, beforeMorph, "Camera transitions cannot be interrupted by touch gestures");
  cleanup();
  assert.equal(listeners.size, 0);
  assert.equal(captured.size, 0);
  assert.equal(canvas.style.touchAction, "auto");
  assert.equal(canvas.dataset.touchNavigation, undefined);
});
