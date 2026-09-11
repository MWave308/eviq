import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useAppContext } from '../context/AppContext';
import './Car3DViewer.css';

/**
 * Car3DViewer — the single reusable 3D vehicle experience for the whole app.
 *
 * Every major "car showcase" surface (dashboard hero, range/energy panels,
 * live journey glance) renders the SAME model + material setup through this
 * one component, so there is exactly one implementation to maintain.
 *
 * Design is fixed to a metallic-trim / transparent-glass body with a
 * theme-reactive paint job — no material picker UI is exposed, per spec.
 * The visible sky (sun-lit day / starry night) is a themed CSS layer behind
 * a transparent canvas; the loaded HDRI cubemap is used only for realistic
 * metallic reflections (scene.environment), never as the visible background.
 *
 * `interactive` controls whether drag-to-orbit / scroll-to-zoom is enabled.
 * On the interactive instance, scrolling over the car cycles between three
 * curated camera presets — Default / Top / Bottom — as a smooth, eased
 * "walkaround" transition instead of a raw zoom. Non-interactive instances
 * (used in smaller/secondary panels) render at a lower pixel ratio and skip
 * OrbitControls, so they stay lightweight. Both variants still support
 * click/tap to pause the idle rotation.
 */

const ASSET_BASE = `${import.meta.env.BASE_URL}assets/car3d/`;
const MODEL_URL = `${ASSET_BASE}ferrari.glb`;
const DRACO_PATH = `${ASSET_BASE}draco/`;
const SKYBOX_PATH = `${ASSET_BASE}textures/cube/skyboxsun25deg/`;
const SKYBOX_URLS = ['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'];

// Module-level cache so switching views doesn't re-download/re-parse the
// model and skybox every time a new viewer instance mounts.
let cachedGltfPromise = null;
function loadCarModel() {
  if (!cachedGltfPromise) {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_PATH);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    cachedGltfPromise = loader.loadAsync(MODEL_URL);
  }
  return cachedGltfPromise;
}

// The cubemap is loaded once and used purely as scene.environment (reflection
// data for the metallic paint/trim/glass) — it is never assigned as the
// visible scene.background. The visible sky is themed CSS behind the
// transparent canvas instead (see Car3DViewer.css .car3d-sky--day / --night).
let cachedEnvMapPromise = null;
function loadEnvMap(renderer) {
  if (!cachedEnvMapPromise) {
    const cubeLoader = new THREE.CubeTextureLoader().setPath(SKYBOX_PATH);
    cachedEnvMapPromise = new Promise((resolve, reject) => {
      cubeLoader.load(
        SKYBOX_URLS,
        (cubeTexture) => {
          const pmrem = new THREE.PMREMGenerator(renderer);
          const envRT = pmrem.fromCubemap(cubeTexture);
          pmrem.dispose();
          resolve({ envMap: envRT.texture });
        },
        undefined,
        reject
      );
    });
  }
  return cachedEnvMapPromise;
}

// Soft procedural contact-shadow disc, drawn once to a canvas and reused
// (geometry + material shared across every mounted viewer) so every
// instance gets a grounded, premium "showroom floor" read under the car
// without any extra image assets.
let cachedShadowGeo = null;
let cachedShadowMat = null;
function getContactShadowMesh() {
  if (!cachedShadowMat) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    cachedShadowMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 });
  }
  if (!cachedShadowGeo) cachedShadowGeo = new THREE.PlaneGeometry(4.6, 4.6);
  const mesh = new THREE.Mesh(cachedShadowGeo, cachedShadowMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002;
  return mesh;
}

// Theme-reactive paint + lighting presets. Only the body finish and the
// scene's ambient/key/rim lighting change between themes — the model, glass,
// and metallic trim stay identical, per spec. Tuned for a deeper, glossier
// "premium metallic" read: higher clearcoat, lower clearcoat roughness, and
// a subtle tinted rim light for edge definition against either sky.
const VEHICLE_THEME = {
  dark: {
    body: { color: 0x14161c, metalness: 0.94, roughness: 0.2, clearcoat: 0.85, clearcoatRoughness: 0.12 },
    hemi: { sky: 0xdfe9ff, ground: 0x05060a, intensity: 0.55 },
    key: { intensity: 1.15 },
    rim: { color: 0x33e6ff, intensity: 0.4 },
    exposure: 1.08,
  },
  light: {
    body: { color: 0xf7f9fc, metalness: 0.55, roughness: 0.12, clearcoat: 0.95, clearcoatRoughness: 0.05 },
    hemi: { sky: 0xffffff, ground: 0xc9cfdc, intensity: 0.85 },
    key: { intensity: 1.0 },
    rim: { color: 0xffc98a, intensity: 0.3 },
    exposure: 1.02,
  },
};

const THEME_TRANSITION_MS = 650;
const VIEW_TRANSITION_MS = 950;
const WHEEL_COOLDOWN_MS = 850;
const CLICK_MOVE_THRESHOLD_PX = 4;
const CLICK_MAX_DURATION_MS = 500;

const VIEW_LABELS = ['Default', 'Top', 'Bottom'];

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

function buildViewPresets() {
  return [
    { position: new THREE.Vector3(3.4, 1.7, 4.6), target: new THREE.Vector3(0, 0.45, 0) }, // Default 3/4
    { position: new THREE.Vector3(0.5, 6.6, 0.7), target: new THREE.Vector3(0, 0.4, 0) }, // Top
    { position: new THREE.Vector3(0.5, -5.0, 0.7), target: new THREE.Vector3(0, 0.15, 0) }, // Bottom
  ];
}

export default function Car3DViewer({
  size = 'lg', // 'sm' | 'md' | 'lg'
  interactive = true,
  autoRotate = true,
  showBackground = true,
  className = '',
  label,
}) {
  const { theme } = useAppContext();
  const containerRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [paused, setPaused] = useState(!autoRotate);
  const [viewIndex, setViewIndex] = useState(0);

  // Kept in refs so the theme-reactive effect (below) can update the live
  // scene without tearing down and rebuilding the whole WebGL context.
  const themeRef = useRef(theme);
  const rendererRef = useRef(null);
  const bodyMatRef = useRef(null);
  const hemiLightRef = useRef(null);
  const keyLightRef = useRef(null);
  const rimLightRef = useRef(null);
  const themeTransitionRef = useRef(null);
  const pausedRef = useRef(!autoRotate);
  const viewIndexRef = useRef(0);
  const viewTransitionRef = useRef(null);

  themeRef.current = theme;

  // ---------- heavy init: renderer / scene / model. Only re-runs when the
  // viewer's own mode changes (interactive vs not, background on/off) —
  // never on theme or pause changes, so those stay smooth and cheap. ----------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    viewIndexRef.current = 0;
    viewTransitionRef.current = null;
    setViewIndex(0);

    let renderer, scene, camera, controls, model, shadowMesh, animationId;
    let ownMaterials = [];
    let disposed = false;
    const clock = new THREE.Clock();
    const viewPresets = buildViewPresets();

    const dpr = interactive ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1.25);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(dpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const initialPreset = VEHICLE_THEME[themeRef.current] || VEHICLE_THEME.dark;
    renderer.toneMappingExposure = initialPreset.exposure;
    // alpha:true + no scene.background => the canvas stays fully
    // transparent, so the themed CSS sky (day sun-glow / starry night)
    // painted behind it in Car3DViewer.css shows through.
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    camera.position.copy(viewPresets[0].position);

    const hemi = new THREE.HemisphereLight(initialPreset.hemi.sky, initialPreset.hemi.ground, initialPreset.hemi.intensity);
    scene.add(hemi);
    hemiLightRef.current = hemi;

    const key = new THREE.DirectionalLight(0xffffff, initialPreset.key.intensity);
    key.position.set(5, 8, 4);
    scene.add(key);
    keyLightRef.current = key;

    // Subtle tinted rim/fill light from behind-opposite the key light —
    // a small three-point-lighting touch that keeps metallic edges defined
    // and reads as "studio showroom" rather than a flat single-light scene.
    const rim = new THREE.DirectionalLight(initialPreset.rim.color, initialPreset.rim.intensity);
    rim.position.set(-4, 3, -5);
    scene.add(rim);
    rimLightRef.current = rim;

    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(viewPresets[0].target);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 3.2;
      controls.maxDistance = 8.5;
      controls.maxPolarAngle = Math.PI - 0.02;
      controls.minPolarAngle = 0.02;
      // Auto-rotate is only the idle "showcase spin" in the Default view —
      // drag-to-orbit is handled independently by OrbitControls and stays
      // live no matter what autoRotate is set to.
      controls.autoRotate = !pausedRef.current;
      controls.autoRotateSpeed = 1.1;
      // Scroll is repurposed as the premium Default/Top/Bottom view switch
      // below, so native scroll-to-zoom is turned off — pinch/drag orbiting
      // is unaffected.
      controls.enableZoom = false;
      controls.enablePan = false;
    } else {
      camera.lookAt(viewPresets[0].target);
    }

    function resize() {
      if (!container) return;
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // ---------- click/tap to pause the idle rotation ----------
    // A short, low-movement pointer interaction toggles the pause state.
    // This never touches drag-to-orbit — OrbitControls keeps handling that
    // directly on the same canvas, entirely independently.
    let downX = 0;
    let downY = 0;
    let downTime = 0;
    let dragged = false;

    function togglePause() {
      pausedRef.current = !pausedRef.current;
      if (controls) controls.autoRotate = viewIndexRef.current === 0 && !pausedRef.current;
      setPaused(pausedRef.current);
    }
    function handlePointerDown(e) {
      downX = e.clientX;
      downY = e.clientY;
      downTime = performance.now();
      dragged = false;
    }
    function handlePointerMove(e) {
      if (Math.abs(e.clientX - downX) > CLICK_MOVE_THRESHOLD_PX || Math.abs(e.clientY - downY) > CLICK_MOVE_THRESHOLD_PX) {
        dragged = true;
      }
    }
    function handlePointerUp() {
      const elapsed = performance.now() - downTime;
      if (!dragged && elapsed < CLICK_MAX_DURATION_MS) togglePause();
    }
    function handlePointerCancel() {
      dragged = true;
    }
    const canvasEl = renderer.domElement;
    canvasEl.addEventListener('pointerdown', handlePointerDown);
    canvasEl.addEventListener('pointermove', handlePointerMove);
    canvasEl.addEventListener('pointerup', handlePointerUp);
    canvasEl.addEventListener('pointercancel', handlePointerCancel);

    // ---------- premium scroll: Default / Top / Bottom view switching ----------
    // Scrolling over the interactive hero steps discretely between three
    // curated camera presets (instead of a raw zoom), eased and debounced so
    // it reads as a deliberate, cinematic walkaround rather than a jumpy
    // wheel-zoom. A short cooldown after each step keeps fast trackpad
    // scroll gestures from firing multiple jumps at once.
    let wheelCooldown = false;
    let wheelCooldownTimer = null;

    function startViewTransition(nextIndex) {
      const from = {
        position: camera.position.clone(),
        target: controls ? controls.target.clone() : viewPresets[0].target.clone(),
      };
      const to = viewPresets[nextIndex];
      viewTransitionRef.current = {
        start: performance.now(),
        from,
        to: { position: to.position.clone(), target: to.target.clone() },
      };
      if (controls) controls.enabled = false;
      viewIndexRef.current = nextIndex;
      setViewIndex(nextIndex);
    }

    function handleWheel(e) {
      if (!interactive) return;
      e.preventDefault();
      if (wheelCooldown) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const next = Math.min(viewPresets.length - 1, Math.max(0, viewIndexRef.current + dir));
      if (next === viewIndexRef.current) return;
      wheelCooldown = true;
      clearTimeout(wheelCooldownTimer);
      wheelCooldownTimer = setTimeout(() => {
        wheelCooldown = false;
      }, WHEEL_COOLDOWN_MS);
      startViewTransition(next);
    }
    if (interactive) canvasEl.addEventListener('wheel', handleWheel, { passive: false });

    Promise.all([loadCarModel(), loadEnvMap(renderer)])
      .then(([gltf, env]) => {
        if (disposed) return;
        const source = gltf.scene.children[0] || gltf.scene;
        // IMPORTANT: the loaded glTF is cached and shared across every
        // mounted viewer (dashboard, range, energy, live journey can all be
        // showing one at once, and views mount/unmount as the user
        // navigates). Adding the shared object directly to more than one
        // scene reparents it out of the others, and disposing it on one
        // instance's unmount would destroy the GPU buffers for every other
        // instance still using it. Each viewer gets its own clone instead —
        // clone() shares geometry buffers by reference (cheap, read-only,
        // never disposed here) but gives each instance independent nodes,
        // so materials (created fresh per instance below) can be swapped
        // and disposed per-viewer without touching any other instance.
        model = source.clone(true);

        // Reflections only — the visible sky is the themed CSS layer behind
        // the transparent canvas (see comment on loadEnvMap above).
        scene.environment = env.envMap;

        // Showcase materials: theme-reactive body paint, metallic trim/rims,
        // smoked transparent glass — tuned for a deeper, glossier "premium
        // metallic" finish, with the body finish adapting to dark/light mode.
        const preset = VEHICLE_THEME[themeRef.current] || VEHICLE_THEME.dark;
        const bodyMat = new THREE.MeshPhysicalMaterial({
          color: preset.body.color,
          envMap: env.envMap,
          envMapIntensity: 1.3,
          metalness: preset.body.metalness,
          roughness: preset.body.roughness,
          clearcoat: preset.body.clearcoat,
          clearcoatRoughness: preset.body.clearcoatRoughness,
          name: 'theme-body',
        });
        bodyMatRef.current = bodyMat;

        const trimMat = new THREE.MeshStandardMaterial({
          color: 0x8a8a8a, envMap: env.envMap, envMapIntensity: 1.8, metalness: 1, roughness: 0.16, name: 'metallic',
        });
        // Transparent smoked-glass option, kept identical across both
        // themes and every view angle — only the body paint reacts to
        // day/night, the glass stays glass.
        const glassMat = new THREE.MeshPhysicalMaterial({
          color: 0x141a22, envMap: env.envMap, metalness: 0.05, roughness: 0.04, ior: 1.5,
          transmission: 0.9, opacity: 0.35, transparent: true, name: 'smoked-glass',
        });
        ownMaterials = [bodyMat, trimMat, glassMat];

        model.traverse((child) => {
          if (!child.isMesh) return;
          if (child.name === 'body') child.material = bodyMat;
          else if (['rim_fl', 'rim_fr', 'rim_rr', 'rim_rl', 'trim'].includes(child.name)) child.material = trimMat;
          else if (child.name === 'glass') child.material = glassMat;
          else if (child.material) {
            // Other parts (interior, brakes, wheels…) keep their original
            // look but still need the shared env map for reflections.
            child.material = child.material.clone();
            child.material.envMap = env.envMap;
            ownMaterials.push(child.material);
          }
        });

        // Vehicle is centered/placed once here and never translated again —
        // only rotation.y changes afterward, so its position stays fixed
        // regardless of rotation, pause state, or camera zoom.
        scene.add(model);

        // Soft grounded contact shadow beneath the car — cheap, no extra
        // assets, and reads as a proper showroom floor instead of the car
        // floating in space.
        shadowMesh = getContactShadowMesh();
        scene.add(shadowMesh);

        setStatus('ready');
      })
      .catch(() => {
        if (!disposed) setStatus('error');
      });

    function applyPendingThemeTransition() {
      const t = themeTransitionRef.current;
      if (!t) return;
      const now = performance.now();
      const raw = Math.min(1, (now - t.start) / THEME_TRANSITION_MS);
      const k = easeInOutCubic(raw);

      if (bodyMatRef.current) {
        bodyMatRef.current.color.copy(t.from.color).lerp(t.to.color, k);
        bodyMatRef.current.metalness = THREE.MathUtils.lerp(t.from.metalness, t.to.metalness, k);
        bodyMatRef.current.roughness = THREE.MathUtils.lerp(t.from.roughness, t.to.roughness, k);
        bodyMatRef.current.clearcoat = THREE.MathUtils.lerp(t.from.clearcoat, t.to.clearcoat, k);
        bodyMatRef.current.clearcoatRoughness = THREE.MathUtils.lerp(t.from.clearcoatRoughness, t.to.clearcoatRoughness, k);
      }
      if (hemiLightRef.current) {
        hemiLightRef.current.color.copy(t.from.hemiSky).lerp(t.to.hemiSky, k);
        hemiLightRef.current.groundColor.copy(t.from.hemiGround).lerp(t.to.hemiGround, k);
        hemiLightRef.current.intensity = THREE.MathUtils.lerp(t.from.hemiIntensity, t.to.hemiIntensity, k);
      }
      if (keyLightRef.current) {
        keyLightRef.current.intensity = THREE.MathUtils.lerp(t.from.keyIntensity, t.to.keyIntensity, k);
      }
      if (rimLightRef.current) {
        rimLightRef.current.color.copy(t.from.rimColor).lerp(t.to.rimColor, k);
        rimLightRef.current.intensity = THREE.MathUtils.lerp(t.from.rimIntensity, t.to.rimIntensity, k);
      }
      if (rendererRef.current) {
        rendererRef.current.toneMappingExposure = THREE.MathUtils.lerp(t.from.exposure, t.to.exposure, k);
      }
      if (raw >= 1) themeTransitionRef.current = null;
    }

    function applyPendingViewTransition() {
      const vt = viewTransitionRef.current;
      if (!vt) return false;
      const raw = Math.min(1, (performance.now() - vt.start) / VIEW_TRANSITION_MS);
      const k = easeInOutCubic(raw);
      camera.position.lerpVectors(vt.from.position, vt.to.position, k);
      const lerpedTarget = new THREE.Vector3().lerpVectors(vt.from.target, vt.to.target, k);
      camera.lookAt(lerpedTarget);
      if (controls) controls.target.copy(lerpedTarget);
      if (raw >= 1) {
        viewTransitionRef.current = null;
        if (controls) {
          controls.target.copy(vt.to.target);
          controls.enabled = interactive;
          controls.update();
          controls.autoRotate = viewIndexRef.current === 0 && !pausedRef.current;
        }
      }
      return true;
    }

    function animate() {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const transitioning = applyPendingViewTransition();
      if (!transitioning) {
        if (controls) {
          // controls.update() advances the idle auto-rotate azimuth only when
          // controls.autoRotate is true; damped drag/orbit from user input is
          // processed every frame regardless, so drag-to-orbit keeps working
          // exactly the same whether rotation is paused or not.
          controls.update();
        } else if (model && !pausedRef.current) {
          model.rotation.y += delta * 0.28;
        }
      }
      applyPendingThemeTransition();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      clearTimeout(wheelCooldownTimer);
      resizeObserver.disconnect();
      canvasEl.removeEventListener('pointerdown', handlePointerDown);
      canvasEl.removeEventListener('pointermove', handlePointerMove);
      canvasEl.removeEventListener('pointerup', handlePointerUp);
      canvasEl.removeEventListener('pointercancel', handlePointerCancel);
      if (interactive) canvasEl.removeEventListener('wheel', handleWheel);
      controls?.dispose();
      // Only dispose what THIS instance exclusively owns: the materials
      // created for it above. Object3D.clone() reuses the SAME
      // BufferGeometry references as the cached source model (geometry is
      // not deep-cloned), and the env map / contact-shadow geometry+material
      // are shared from module-level caches too — so none of those are
      // disposed here, or every other mounted/future viewer would go blank.
      if (model) scene.remove(model);
      if (shadowMesh) scene.remove(shadowMesh);
      ownMaterials.forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      rendererRef.current = null;
      bodyMatRef.current = null;
      hemiLightRef.current = null;
      keyLightRef.current = null;
      rimLightRef.current = null;
      themeTransitionRef.current = null;
      viewTransitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, showBackground]);

  // ---------- theme-reactive repaint ----------
  // Runs on every theme change and smoothly cross-fades the body paint and
  // scene lighting on the *existing* scene (no renderer/model rebuild), so
  // switching Light/Dark never flashes or reloads the model. The transparent
  // glass is intentionally excluded — it stays exactly as-is across themes.
  useEffect(() => {
    const preset = VEHICLE_THEME[theme] || VEHICLE_THEME.dark;
    const bodyMat = bodyMatRef.current;
    const hemi = hemiLightRef.current;
    const key = keyLightRef.current;
    const rim = rimLightRef.current;
    const renderer = rendererRef.current;
    // Model/scene not ready yet (still loading) — the initial material
    // creation above already reads the current theme directly, so there's
    // nothing to cross-fade from yet.
    if (!bodyMat || !hemi || !key || !rim || !renderer) return;

    themeTransitionRef.current = {
      start: performance.now(),
      from: {
        color: bodyMat.color.clone(),
        metalness: bodyMat.metalness,
        roughness: bodyMat.roughness,
        clearcoat: bodyMat.clearcoat,
        clearcoatRoughness: bodyMat.clearcoatRoughness,
        hemiSky: hemi.color.clone(),
        hemiGround: hemi.groundColor.clone(),
        hemiIntensity: hemi.intensity,
        keyIntensity: key.intensity,
        rimColor: rim.color.clone(),
        rimIntensity: rim.intensity,
        exposure: renderer.toneMappingExposure,
      },
      to: {
        color: new THREE.Color(preset.body.color),
        metalness: preset.body.metalness,
        roughness: preset.body.roughness,
        clearcoat: preset.body.clearcoat,
        clearcoatRoughness: preset.body.clearcoatRoughness,
        hemiSky: new THREE.Color(preset.hemi.sky),
        hemiGround: new THREE.Color(preset.hemi.ground),
        hemiIntensity: preset.hemi.intensity,
        keyIntensity: preset.key.intensity,
        rimColor: new THREE.Color(preset.rim.color),
        rimIntensity: preset.rim.intensity,
        exposure: preset.exposure,
      },
    };
    // status is read so this effect re-checks refs once loading completes
    // if the theme happened to change while the model was still in flight.
  }, [theme, status]);

  return (
    <div className={`car3d-stage car3d-stage--${size} ${className}`}>
      {showBackground && (
        <>
          <div className="car3d-sky car3d-sky--day" aria-hidden="true">
            <div className="car3d-clouds car3d-clouds--day" />
          </div>
          <div className="car3d-sky car3d-sky--night" aria-hidden="true">
            <div className="car3d-clouds car3d-clouds--night" />
            <span className="car3d-star car3d-star--a" />
            <span className="car3d-star car3d-star--b" />
            <span className="car3d-star car3d-star--c" />
          </div>
          <div className="car3d-ground car3d-ground--day" aria-hidden="true" />
          <div className="car3d-ground car3d-ground--night" aria-hidden="true" />
        </>
      )}
      <div
        className="car3d-canvas"
        ref={containerRef}
        role="img"
        aria-label={label || 'Interactive 3D view of the electric car'}
      />
      {status === 'loading' && (
        <div className="car3d-overlay">
          <span className="spinner-ring" />
          <span className="car3d-overlay-text">Loading 3D model…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="car3d-overlay">
          <span className="car3d-overlay-text">3D view unavailable right now.</span>
        </div>
      )}
      {/* View indicator only on the larger, fully-interactive showcase —
          the text hint pill was removed (it overlapped/cluttered the view),
          but click/tap-to-pause and scroll-to-switch-view both still work
          silently on the canvas itself; see the pointer/wheel handlers above. */}
      {interactive && status === 'ready' && (
        <span className="car3d-view-indicator" aria-hidden="true">
          {VIEW_LABELS.map((l, i) => (
            <span key={l} className={`car3d-view-dot ${viewIndex === i ? 'car3d-view-dot--active' : ''}`} />
          ))}
        </span>
      )}
    </div>
  );
}
