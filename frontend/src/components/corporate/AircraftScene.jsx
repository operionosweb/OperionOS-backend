import React, { useEffect, useRef, useState } from "react";
import {
  AmbientLight, ACESFilmicToneMapping, BufferGeometry, CanvasTexture,
  CatmullRomCurve3, Color, DirectionalLight, DoubleSide, Float32BufferAttribute,
  Group, LatheGeometry, Mesh, MeshStandardMaterial, PerspectiveCamera,
  RingGeometry, Scene, Shape, ShapeGeometry, SphereGeometry, SRGBColorSpace,
  TorusGeometry, Vector2, Vector3, WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";

function fuselageTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Aircraft livery canvas is unavailable.");
  context.fillStyle = "#f3f6fa";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#d4dde8";
  context.fillRect(0, 0, 370, 1024);
  context.fillRect(1678, 0, 370, 1024);
  context.fillStyle = "#0066f5";
  context.fillRect(478, 180, 7, 650);
  context.fillRect(1563, 180, 7, 650);
  for (const column of [582, 1466]) {
    context.fillStyle = "#163147";
    for (let index = 0; index < 40; index++) {
      const y = 225 + index * 13;
      if (index === 5 || index === 19 || index === 35) continue;
      context.beginPath();
      context.roundRect(column, y, 15, 7, 3);
      context.fill();
    }
    context.strokeStyle = "#7b91a6";
    context.lineWidth = 2;
    for (const y of [195, 295, 477, 730]) {
      context.strokeRect(column - 12, y, 40, 13);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function airfoil(stations, side, material) {
  const vertices = [];
  const indices = [];
  const segments = 20;
  for (const station of stations) {
    for (const surface of [1, -1]) {
      for (let index = 0; index <= segments; index++) {
        const chord = index / segments;
        const thickness = 5 * station.thickness * (
          0.2969 * Math.sqrt(chord) - 0.126 * chord - 0.3516 * chord ** 2
          + 0.2843 * chord ** 3 - 0.1036 * chord ** 4
        );
        vertices.push(
          side * station.span,
          station.height + surface * thickness * station.chord,
          station.leading - chord * station.chord,
        );
      }
    }
  }
  const stride = 2 * (segments + 1);
  for (let station = 0; station < stations.length - 1; station++) {
    for (let surface = 0; surface < 2; surface++) {
      for (let index = 0; index < segments; index++) {
        const a = station * stride + surface * (segments + 1) + index;
        const b = a + stride;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new Mesh(geometry, material);
}

function buildAircraft() {
  const aircraft = new Group();
  const white = new MeshStandardMaterial({ color: "#eff4fa", roughness: 0.3, metalness: 0.22, side: DoubleSide });
  const blue = new MeshStandardMaterial({ color: "#0066f5", roughness: 0.33, metalness: 0.18, side: DoubleSide });
  const metal = new MeshStandardMaterial({ color: "#b4c0cf", roughness: 0.25, metalness: 0.7, side: DoubleSide });
  const dark = new MeshStandardMaterial({ color: "#132237", roughness: 0.65, metalness: 0.25, side: DoubleSide });
  const livery = new MeshStandardMaterial({ map: fuselageTexture(), roughness: 0.35, metalness: 0.15 });

  // The axis is +Z toward the nose. Wings and engines share this coordinate system.
  const profile = [
    [0.006, -4.1], [0.07, -3.85], [0.19, -3.45], [0.32, -2.85],
    [0.41, -2.1], [0.44, -1.2], [0.44, 1.65], [0.42, 2.25],
    [0.36, 2.7], [0.27, 3.05], [0.16, 3.3], [0.06, 3.48], [0.001, 3.54],
  ];
  const smoothProfile = new CatmullRomCurve3(profile.map(([radius, length]) => new Vector3(radius, length, 0)));
  const bodyGeometry = new LatheGeometry(
    smoothProfile.getPoints(128).map((point) => new Vector2(Math.max(point.x, 0.001), point.y)), 96,
  );
  bodyGeometry.rotateX(Math.PI / 2);
  aircraft.add(new Mesh(bodyGeometry, livery));
  const windowGeometry = new SphereGeometry(1, 12, 8);
  for (const side of [-1, 1]) {
    for (let index = 0; index < 38; index++) {
      if ([4, 18, 33].includes(index)) continue;
      const length = 1.83 - index * 0.1;
      const radius = length < -1.2 ? 0.44 - (-1.2 - length) * 0.033 : 0.44;
      const windowMesh = new Mesh(windowGeometry, dark);
      windowMesh.position.set(side * Math.sqrt(radius ** 2 - 0.115 ** 2), 0.115, length);
      windowMesh.scale.set(0.014, 0.027, 0.018);
      aircraft.add(windowMesh);
    }
  }

  for (const side of [-1, 1]) {
    const cockpit = new BufferGeometry();
    cockpit.setAttribute("position", new Float32BufferAttribute([
      side * 0.012, 0.22, 3.13,
      side * 0.19, 0.2, 3.07,
      side * 0.275, 0.16, 2.88,
      side * 0.22, 0.29, 2.84,
      side * 0.045, 0.32, 2.94,
    ], 3));
    cockpit.setIndex([0, 1, 4, 1, 2, 3, 1, 3, 4]);
    cockpit.computeVertexNormals();
    aircraft.add(new Mesh(cockpit, dark));
  }

  const fans = [];
  for (const side of [-1, 1]) {
    aircraft.add(airfoil([
      { span: 0.3, height: -0.1, leading: 0.7, chord: 2.0, thickness: 0.1 },
      { span: 1.5, height: -0.03, leading: 0.07, chord: 1.34, thickness: 0.085 },
      { span: 3.05, height: 0.15, leading: -0.88, chord: 0.66, thickness: 0.075 },
      { span: 3.7, height: 0.39, leading: -1.37, chord: 0.24, thickness: 0.065 },
      { span: 3.85, height: 0.69, leading: -1.53, chord: 0.12, thickness: 0.055 },
    ], side, white));
    aircraft.add(airfoil([
      { span: 0.16, height: 0.15, leading: -2.58, chord: 0.95, thickness: 0.09 },
      { span: 1.48, height: 0.32, leading: -3.4, chord: 0.3, thickness: 0.075 },
    ], side, white));

    const engine = new Group();
    const cowlingProfile = [
      [0.21, -0.59], [0.28, -0.34], [0.32, 0.14], [0.31, 0.47],
      [0.286, 0.53], [0.26, 0.47], [0.248, 0.13], [0.21, -0.59],
    ].map(([radius, length]) => new Vector2(radius, length));
    const cowling = new LatheGeometry(cowlingProfile, 64);
    cowling.rotateX(Math.PI / 2);
    engine.add(new Mesh(cowling, white));
    const lip = new Mesh(new TorusGeometry(0.285, 0.024, 16, 64), metal);
    lip.position.z = 0.49;
    engine.add(lip);
    const fan = new Group();
    fan.position.z = 0.34;
    const fanBack = new Mesh(new RingGeometry(0.03, 0.263, 48), dark);
    fan.add(fanBack);
    for (let index = 0; index < 22; index++) {
      const blade = new Shape();
      blade.moveTo(0.035, -0.009);
      blade.quadraticCurveTo(0.17, -0.05, 0.25, -0.015);
      blade.lineTo(0.25, 0.018);
      blade.quadraticCurveTo(0.15, 0.005, 0.035, 0.014);
      const mesh = new Mesh(new ShapeGeometry(blade), metal);
      mesh.rotation.z = index * Math.PI * 2 / 22;
      mesh.position.z = 0.006;
      fan.add(mesh);
    }
    const spinner = new Mesh(new SphereGeometry(0.065, 24, 20), metal);
    spinner.scale.z = 1.9;
    spinner.position.z = 0.05;
    fan.add(spinner);
    engine.add(fan);
    fans.push(fan);
    const exhaustGeometry = new LatheGeometry([
      new Vector2(0.13, -0.7), new Vector2(0.19, -0.52), new Vector2(0.19, -0.35),
    ], 48);
    exhaustGeometry.rotateX(Math.PI / 2);
    engine.add(new Mesh(exhaustGeometry, dark));
    const pylon = airfoil([
      { span: 0, height: 0.24, leading: 0.32, chord: 0.72, thickness: 0.12 },
      { span: 0.04, height: 0.63, leading: 0.05, chord: 0.64, thickness: 0.1 },
    ], side, white);
    engine.add(pylon);
    engine.position.set(side * 1.32, -0.55, 0.39);
    aircraft.add(engine);
  }

  const finShape = new Shape();
  finShape.moveTo(-3.85, 0.13);
  finShape.lineTo(-3.72, 1.72);
  finShape.quadraticCurveTo(-3.69, 1.81, -3.59, 1.76);
  finShape.lineTo(-2.39, 0.27);
  finShape.closePath();
  const fin = new Mesh(new ShapeGeometry(finShape, 24), blue);
  fin.rotation.y = -Math.PI / 2;
  aircraft.add(fin);
  return { aircraft, fans };
}

export default function AircraftScene() {
  const hostRef = useRef(null);
  const controlsRef = useRef(null);
  const [unavailable, setUnavailable] = useState(false);
  const [rotating, setRotating] = useState(false);
  const rotatingRef = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch (error) {
      console.error("Corporate aircraft WebGL initialization failed", error);
      setUnavailable(true);
      return undefined;
    }
    const scene = new Scene();
    const camera = new PerspectiveCamera(35, 1, 0.1, 100);
    const initialCamera = new Vector3(8.7, 5.2, 10.5);
    camera.position.copy(initialCamera);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(new Color("#f0f6ff"), 0);
    renderer.domElement.setAttribute("aria-label", "Interactive commercial airliner: drag to orbit or use the view control buttons");
    renderer.domElement.setAttribute("role", "img");
    host.appendChild(renderer.domElement);
    scene.add(new AmbientLight("#e3edff", 2));
    for (const [color, intensity, position] of [
      ["#ffffff", 4, [8, 12, 10]], ["#83b5ff", 2, [-8, 2, -4]], ["#ffffff", 2.5, [0, 8, -8]],
    ]) {
      const light = new DirectionalLight(color, intensity);
      light.position.set(...position);
      scene.add(light);
    }
    const { aircraft, fans } = buildAircraft();
    aircraft.rotation.y = -0.2;
    scene.add(aircraft);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minDistance = 10;
    controls.maxDistance = 23;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = Math.PI * 0.77;
    controls.autoRotateSpeed = 0.65;
    controls.target.set(0, 0.1, -0.15);
    controlsRef.current = { controls, camera, initialCamera };
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resize.observe(host);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    visibility.observe(host);
    let previousTime = 0;
    renderer.setAnimationLoop((time) => {
      if (!visible || document.hidden) { previousTime = time; return; }
      const delta = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      controls.autoRotate = rotatingRef.current;
      if (!motion.matches) fans.forEach((fan) => { fan.rotation.z += delta * 9; });
      controls.update();
      renderer.render(scene, camera);
    });
    return () => {
      renderer.setAnimationLoop(null);
      resize.disconnect();
      visibility.disconnect();
      controls.dispose();
      controlsRef.current = null;
      const geometries = new Set();
      const materialsToDispose = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        materials.forEach((material) => materialsToDispose.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose());
      materialsToDispose.forEach((material) => { material.map?.dispose(); material.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  function zoom(factor) {
    const state = controlsRef.current;
    if (!state) return;
    const offset = state.camera.position.clone().sub(state.controls.target);
    offset.setLength(Math.min(23, Math.max(10, offset.length() * factor)));
    state.camera.position.copy(state.controls.target).add(offset);
  }

  return <div className="oaero-aircraft">
    <div className="oaero-aircraft-halo" aria-hidden="true"/>
    <div className="oaero-aircraft-canvas" ref={hostRef}/>
    {unavailable && <div className="oaero-aircraft-unavailable" role="status"><strong>3D aircraft unavailable</strong><p>This browser could not initialize WebGL. All website content remains available.</p></div>}
    <span className="oaero-aircraft-caption">Commercial airliner · interactive 3D illustration</span>
    {!unavailable && <div className="oaero-aircraft-controls" role="group" aria-label="Aircraft view controls">
      <button type="button" aria-label="Zoom aircraft in" onClick={() => zoom(0.87)}><ZoomIn size={17}/></button>
      <button type="button" aria-label="Zoom aircraft out" onClick={() => zoom(1.15)}><ZoomOut size={17}/></button>
      <button type="button" aria-label="Rotate aircraft automatically" aria-pressed={rotating} onClick={() => {
        rotatingRef.current = !rotatingRef.current;
        setRotating(rotatingRef.current);
      }}><RotateCw size={17}/></button>
      <button type="button" aria-label="Reset aircraft view" onClick={() => {
        const state = controlsRef.current;
        if (!state) return;
        state.camera.position.copy(state.initialCamera);
        state.controls.target.set(0, 0.1, -0.15);
        rotatingRef.current = false;
        setRotating(false);
        state.controls.update();
      }}><RotateCcw size={17}/></button>
    </div>}
  </div>;
}
