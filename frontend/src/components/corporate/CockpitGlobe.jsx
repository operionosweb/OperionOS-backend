import React, { useEffect, useRef, useState } from "react";
import {
  ACESFilmicToneMapping, AdditiveBlending, AmbientLight, BackSide,
  BufferGeometry, CanvasTexture, Color, ConeGeometry, DirectionalLight, Group,
  Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PerspectiveCamera, QuadraticBezierCurve3, Raycaster, Scene, SphereGeometry,
  SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const RADIUS = 4;

function position(latitude, longitude, radius = RADIUS) {
  const phi = (90 - latitude) * Math.PI / 180;
  const theta = (longitude + 180) * Math.PI / 180;
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function texture(draw) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Cockpit texture canvas is unavailable.");
  draw(context);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  return map;
}

function randomGenerator() {
  let seed = 782;
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

function earthTexture() {
  return texture((context) => {
    const ocean = context.createLinearGradient(0, 0, 0, 1024);
    ocean.addColorStop(0, "#091c36");
    ocean.addColorStop(0.5, "#0b264b");
    ocean.addColorStop(1, "#06162a");
    context.fillStyle = ocean;
    context.fillRect(0, 0, 2048, 1024);
    const continents = [
      [[950,360],[1080,340],[1160,420],[1220,400],[1280,460],[1220,520],[1180,500],[1160,680],[1100,780],[1050,720],[980,560],[920,500],[920,420]],
      [[940,220],[980,200],[1020,180],[1060,210],[1120,220],[1140,290],[1080,330],[980,350],[940,320],[920,260]],
      [[920,200],[945,190],[940,235],[915,230]],
      [[1000,120],[1060,130],[1040,200],[1000,190]],
      [[1140,220],[1300,160],[1500,180],[1680,220],[1780,280],[1700,400],[1560,420],[1480,490],[1400,460],[1340,360],[1220,340]],
      [[1380,400],[1450,410],[1420,530],[1370,460]],
      [[1500,440],[1560,450],[1540,540],[1490,500]],
      [[340,150],[540,160],[640,240],[560,380],[500,420],[420,380],[320,320],[300,220]],
      [[530,520],[640,530],[720,620],[680,780],[600,920],[560,840],[520,650]],
      [[1580,660],[1740,650],[1750,770],[1640,800],[1560,740]],
    ];
    continents.forEach((points) => {
      context.beginPath();
      points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
      context.closePath();
      context.fillStyle = "#426844";
      context.fill();
      context.strokeStyle = "#68a895";
      context.lineWidth = 3;
      context.stroke();
    });
    context.fillStyle = "#c1a162";
    context.beginPath();
    context.ellipse(1080, 425, 120, 45, 0.1, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#e3eaf1";
    context.fillRect(0, 0, 2048, 50);
    context.fillRect(0, 965, 2048, 59);
  });
}

function makeScene(host, aircraft, weather, onSelect) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 100);
  const initialCamera = position(30, 20, 13);
  camera.position.copy(initialCamera);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.setClearColor(new Color("#06162a"), 1);
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", "Illustrative Earth with synthetic flight corridors; drag to orbit and use the view buttons to zoom");
  host.appendChild(renderer.domElement);
  scene.add(new AmbientLight("#ffffff", 1.3));
  const sun = new DirectionalLight("#ffffff", 2.7);
  sun.position.set(16, 12, 14);
  scene.add(sun);
  const rim = new DirectionalLight("#00c2ff", 1.8);
  rim.position.set(-15, -6, -8);
  scene.add(rim);

  const globe = new Group();
  scene.add(globe);
  globe.add(new Mesh(new SphereGeometry(RADIUS, 72, 48), new MeshStandardMaterial({
    map: earthTexture(), roughness: 0.65, metalness: 0.12,
  })));
  const random = randomGenerator();
  const clouds = new Mesh(new SphereGeometry(4.032, 48, 32), new MeshStandardMaterial({
    map: texture((context) => {
      for (let index = 0; index < 280; index++) {
        const x = random() * 2048, y = 100 + random() * 824;
        const gradient = context.createRadialGradient(x, y, 0, x, y, 50);
        gradient.addColorStop(0, "rgba(255,255,255,.55)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = gradient;
        context.fillRect(x - 50, y - 50, 100, 100);
      }
    }), transparent: true, opacity: 0.6, depthWrite: false,
  }));
  globe.add(clouds);
  const radar = new Mesh(new SphereGeometry(4.055, 48, 32), new MeshBasicMaterial({
    map: texture((context) => weather.cells.forEach((cell) => {
      const x = (cell.longitude + 180) / 360 * 2048;
      const y = (90 - cell.latitude) / 180 * 1024;
      const gradient = context.createRadialGradient(x, y, 2, x, y, 50);
      gradient.addColorStop(0, "rgba(239,68,68,.92)");
      gradient.addColorStop(0.35, "rgba(245,158,11,.85)");
      gradient.addColorStop(0.7, "rgba(16,185,129,.75)");
      gradient.addColorStop(1, "rgba(16,185,129,0)");
      context.fillStyle = gradient;
      context.fillRect(x - 50, y - 50, 100, 100);
    })), transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false,
  }));
  globe.add(radar);
  const wind = new Mesh(new SphereGeometry(4.07, 48, 32), new MeshBasicMaterial({
    map: texture((context) => {
      context.strokeStyle = "rgba(56,189,248,.65)";
      context.lineWidth = 2;
      for (let index = 0; index < 220; index++) {
        const x = random() * 2048, y = 180 + random() * 664;
        context.beginPath();
        context.moveTo(x, y);
        context.quadraticCurveTo(x + 40, y - 15, x + 80, y + 10);
        context.stroke();
      }
    }), transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false,
  }));
  globe.add(wind);
  globe.add(new Mesh(new SphereGeometry(4.2, 48, 32), new MeshBasicMaterial({
    color: "#38bdf8", transparent: true, opacity: 0.15, side: BackSide,
    blending: AdditiveBlending, depthWrite: false,
  })));

  const flights = aircraft.map((item) => {
    const from = position(item.route.origin.latitude, item.route.origin.longitude, 4.08);
    const to = position(item.route.destination.latitude, item.route.destination.longitude, 4.08);
    const middle = from.clone().add(to).normalize().multiplyScalar(4.08 + from.distanceTo(to) * 0.3);
    const curve = new QuadraticBezierCurve3(from, middle, to);
    const route = new Line(new BufferGeometry().setFromPoints(curve.getPoints(64)), new LineBasicMaterial({
      color: "#38bdf8", transparent: true, opacity: 0.45,
    }));
    const marker = new Mesh(new ConeGeometry(0.065, 0.2, 8), new MeshBasicMaterial({ color: "#ffffff" }));
    marker.userData.aircraftId = item.id;
    const group = new Group();
    group.add(route, marker);
    for (const point of [from, to]) {
      const pin = new Mesh(new SphereGeometry(0.035, 8, 8), new MeshBasicMaterial({ color: "#00e5d9" }));
      pin.position.copy(point);
      group.add(pin);
    }
    globe.add(group);
    return { item, curve, route, marker, group };
  });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = true;
  renderer.domElement.style.touchAction = "pan-y";
  controls.minDistance = 9;
  controls.maxDistance = 26;
  controls.autoRotateSpeed = 0.35;
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let pointerStart = null;
  const onPointerDown = (event) => { pointerStart = [event.clientX, event.clientY]; };
  const onPointerUp = (event) => {
    if (!pointerStart || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 6) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(flights.filter((flight) => flight.group.visible).map((flight) => flight.marker))[0];
    const earthHit = raycaster.intersectObject(globe.children[0])[0];
    if (hit && (!earthHit || hit.distance < earthHit.distance)) {
      onSelect(hit.object.userData.aircraftId);
    }
  };
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  let firstResize = true;
  const resize = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    initialCamera.setLength(Math.max(13, 4.8 / (Math.tan(Math.PI / 9) * camera.aspect)));
    if (firstResize) { camera.position.copy(initialCamera); firstResize = false; }
    camera.updateProjectionMatrix();
  });
  resize.observe(host);
  let visible = true;
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  observer.observe(host);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let state = { layers: {}, visibleIds: [], selectedId: null, playing: true };
  let elapsed = 0, previousTime = null;
  renderer.setAnimationLoop((time) => {
    const delta = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, 0.05);
    previousTime = time;
    if (!visible || document.hidden) return;
    if (state.playing && !motion.matches) {
      elapsed += delta;
      clouds.rotation.y += delta * 0.015;
      wind.rotation.y += delta * 0.025;
    }
    controls.autoRotate = state.playing && !motion.matches;
    clouds.visible = state.layers.clouds;
    radar.visible = state.layers.weather;
    wind.visible = state.layers.wind;
    flights.forEach(({ item, curve, route, marker, group }, index) => {
      group.visible = state.visibleIds.includes(item.id);
      const selected = item.id === state.selectedId;
      route.visible = state.layers.airspace || selected;
      route.material.opacity = selected ? 0.95 : 0.35;
      route.material.color.set(selected ? "#00e5d9" : "#38bdf8");
      marker.material.color.set(selected ? "#00e5d9" : "#ffffff");
      marker.scale.setScalar(selected ? 1.5 : 1);
      const progress = (0.25 + index * 0.07 + elapsed * 0.025) % 1;
      marker.position.copy(curve.getPoint(progress));
      marker.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), curve.getTangent(progress).normalize());
    });
    controls.update();
    renderer.render(scene, camera);
  });
  return {
    update(next) { state = next; },
    zoom(factor) { camera.position.setLength(Math.min(26, Math.max(9, camera.position.length() * factor))); },
    reset() { camera.position.copy(initialCamera); controls.target.set(0, 0, 0); controls.update(); },
    dispose() {
      renderer.setAnimationLoop(null);
      resize.disconnect();
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      const geometries = new Set(), materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => { material.map?.dispose(); material.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export default function CockpitGlobe({ aircraft, weather, visibleIds, selectedId, layers, playing, onSelect }) {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const [unavailable, setUnavailable] = useState(false);
  const current = useRef({ visibleIds, selectedId, layers, playing });
  current.current = { visibleIds, selectedId, layers, playing };

  useEffect(() => {
    let scene;
    try {
      scene = makeScene(hostRef.current, aircraft, weather, onSelect);
      scene.update(current.current);
      sceneRef.current = scene;
    } catch (error) {
      console.error("Executive Cockpit globe initialization failed", error);
      setUnavailable(true);
    }
    return () => { scene?.dispose(); sceneRef.current = null; };
  }, [aircraft, weather, onSelect]);
  useEffect(() => { sceneRef.current?.update(current.current); }, [visibleIds, selectedId, layers, playing]);

  return <div className="oaero-cockpit-earth">
    <div className="oaero-cockpit-canvas" ref={hostRef} />
    {unavailable ? <div className="oaero-cockpit-fallback" role="status"><strong>3D globe unavailable</strong><p>WebGL could not initialize. Flight selection and contract links remain available alongside this view.</p></div> :
      <div className="oaero-cockpit-view-controls" role="group" aria-label="Globe view controls">
        <button type="button" aria-label="Zoom globe in" onClick={() => sceneRef.current?.zoom(0.85)}>+</button>
        <button type="button" aria-label="Zoom globe out" onClick={() => sceneRef.current?.zoom(1.15)}>-</button>
        <button type="button" onClick={() => sceneRef.current?.reset()}>Reset view</button>
      </div>}
    <span className="oaero-cockpit-map-note">Procedural Earth illustration / not for navigation</span>
  </div>;
}
