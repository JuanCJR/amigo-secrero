// Escenario 3D de José Miguel: render, luces y cámara.
// La pose la decide quien maneja `rig` (ver controller3d.ts); aquí solo se aplica
// cada cuadro junto con el movimiento ambiental (respirar, parpadear, brasa, humo).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildJose, type JoseParts, type Look, type MouthShape } from './model';

export interface StageOptions {
  /** 'pixar' (por defecto): luz de estudio y sombras suaves. 'toon': plano con contorno. */
  look?: Look;
  /** Fondo transparente (para ponerlo sobre la UI). */
  transparent?: boolean;
  background?: string;
  /** Respeta prefers-reduced-motion: sin balanceo ambiental. */
  reducedMotion?: boolean;
  /** Conserva el último cuadro para poder capturarlo (renders fijos). */
  capture?: boolean;
  /** Humo 3D propio (la app usa humo en el DOM y lo apaga). */
  smoke?: boolean;
  /**
   * Encuadre. 'portrait': cámara en perspectiva para vistas previas.
   * 'app': cámara ortográfica alineada con el viewBox 200×250 del rig SVG original
   * (pies en y=244, brasa en y≈40), para que svgToScreen siga calzando.
   */
  framing?: 'portrait' | 'app';
  /** Margen del lienzo alrededor de la caja del personaje, en unidades del viewBox. */
  margin?: { left: number; right: number; top: number; bottom: number };
}

/** Estado de pose que anima el controlador (con GSAP u otro). */
export interface Rig {
  armLz: number;
  armLx: number;
  armRz: number;
  armRx: number;
  /** salto (unidades de mundo) */
  hop: number;
  /** estirar/aplastar: 1 = normal */
  stretch: number;
  /** inclinación del cuerpo (radianes, eje z) */
  lean: number;
  /** giro del cuerpo hacia un lado (radianes, eje y) */
  turn: number;
  /** temblor (amplitud en unidades de mundo) */
  jitter: number;
  /** amplitud del balanceo ambiental (0 = quieto) */
  sway: number;
  mouth: MouthShape;
  /** párpado base 0 abierto, 1 cerrado */
  lid: number;
  browLift: number;
  browTilt: number;
  /** gorro: 1 puesto, 0 no está */
  hat: number;
  /** brillo extra de la brasa */
  flare: number;
  /** mirada -1..1 */
  lookX: number;
  lookY: number;
}

export const defaultRig = (): Rig => ({
  armLz: -0.12,
  armLx: 0,
  armRz: 0.12,
  armRx: 0,
  hop: 0,
  stretch: 1,
  lean: 0,
  turn: 0,
  jitter: 0,
  sway: 1,
  mouth: 'smile',
  lid: 0,
  browLift: 0,
  browTilt: 0,
  hat: 1,
  flare: 0,
  lookX: 0,
  lookY: 0,
});

function softShadow() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.5, '#888888');
  g.addColorStop(1, '#000000');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

const HAT_TILT = 0.42;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Escala del viewBox del rig SVG: unidades SVG por unidad de mundo (pies 244 ↔ brasa 40 = 2.2 u). */
export const SVG_K = (244 - 40) / 2.2;

export class JoseStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.Camera;
  readonly jose: JoseParts;
  readonly rig: Rig = defaultRig();
  /** callback opcional antes de cada cuadro (t en segundos) */
  onFrame?: (t: number) => void;

  private clock = new THREE.Timer();
  private raf = 0;
  private nextBlink = 1.5;
  private blinkT = -1;
  private look = new THREE.Vector2();
  private opts: StageOptions;
  private ro?: ResizeObserver;
  private running = false;
  private resScale = 1;
  private shadowBlob?: THREE.Mesh;
  private smokeOn: boolean;

  constructor(private host: HTMLElement, opts: StageOptions = {}) {
    this.opts = opts;
    this.smokeOn = opts.smoke ?? true;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !!opts.transparent, preserveDrawingBuffer: !!opts.capture });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (!opts.transparent) this.scene.background = new THREE.Color(opts.background || '#0F4A37');
    const look = opts.look ?? 'pixar';
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    if (opts.framing === 'app') {
      const m = opts.margin ?? { left: 0, right: 0, top: 0, bottom: 0 };
      // viewBox (0..200, 0..250) + márgenes → mundo; x=100 ↔ 0, y=244 ↔ 0 (pies)
      const cam = new THREE.OrthographicCamera(
        (-m.left - 100) / SVG_K,
        (200 + m.right - 100) / SVG_K,
        (244 + m.top) / SVG_K,
        (244 - 250 - m.bottom) / SVG_K,
        0.1,
        30,
      );
      cam.position.set(0, 0, 10);
      this.camera = cam;
    } else {
      const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
      cam.position.set(0, 2.6, 8.2);
      cam.lookAt(0, 1.3, 0);
      this.camera = cam;
    }

    if (look === 'pixar') {
      // look "de película": colores fieles a la paleta, reflejos de un estudio, sombras suaves
      this.renderer.toneMapping = THREE.NeutralToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.4;
      pmrem.dispose();

      const key = new THREE.DirectionalLight('#FFE9D2', 2.4); // principal cálida
      key.position.set(0.9, 7, 4.5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.radius = 12;
      key.shadow.blurSamples = 16;
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.02;
      const sc = key.shadow.camera as THREE.OrthographicCamera;
      sc.left = -2;
      sc.right = 2;
      sc.top = 3.5;
      sc.bottom = -0.5;
      sc.near = 0.5;
      sc.far = 12;
      this.scene.add(key);
      const fill = new THREE.DirectionalLight('#CFE2FF', 0.7); // relleno frío
      fill.position.set(-3.5, 2, 3);
      this.scene.add(fill);
      const rim = new THREE.DirectionalLight('#FFD39A', 2.2); // contraluz que separa del fondo
      rim.position.set(-2, 3, -4);
      this.scene.add(rim);
      this.scene.add(new THREE.HemisphereLight('#FFFFFF', '#3A5A50', 0.35));
    } else {
      this.scene.add(new THREE.HemisphereLight('#FFFFFF', '#3A5A50', 1.5));
      const key = new THREE.DirectionalLight('#FFFFFF', 2.6);
      key.position.set(2.5, 4, 4);
      this.scene.add(key);
      const rim = new THREE.DirectionalLight('#FFF1C2', 0.8);
      rim.position.set(-3, 2, -3);
      this.scene.add(rim);
    }

    this.jose = buildJose(look);
    if (opts.framing === 'app') this.jose.root.rotation.x = 0.16; // se inclina hacia la cámara: se ve la brasa
    this.scene.add(this.jose.root);
    if (!this.smokeOn) {
      const s = this.jose.body.getObjectByName('smoke');
      if (s) s.visible = false;
    }
    if (look === 'pixar') {
      this.jose.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !(m.material as THREE.Material).transparent) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      // piso invisible que solo recibe la sombra (sirve también con fondo transparente)
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.2 }));
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      this.scene.add(floor);
    }

    // sombra de contacto
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 40),
      new THREE.MeshBasicMaterial({
        color: '#000000',
        transparent: true,
        opacity: look === 'pixar' ? 0.35 : 0.22,
        depthWrite: false,
        alphaMap: look === 'pixar' ? softShadow() : null,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.y = 0.6;
    shadow.position.y = 0.001;
    this.shadowBlob = shadow;
    this.scene.add(shadow);

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
  }

  resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio * this.resScale, 3));
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Cuando el contenedor se agranda con transform: scale, sube la resolución para no verse borroso. */
  setResolutionScale(s: number) {
    const next = Math.max(1, Math.min(s, 3));
    if (Math.abs(next - this.resScale) < 0.05) return;
    this.resScale = next;
    this.resize();
  }

  blink() {
    this.blinkT = 0;
  }

  /** Proyecta un punto del mundo a coordenadas de pantalla (px del viewport). */
  worldToScreen(v: THREE.Vector3) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const p = v.clone().project(this.camera);
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      this.tick();
    };
    loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Avanza la animación hasta t segundos y dibuja un cuadro (para renders fijos). */
  renderAt(t: number) {
    for (let x = 0; x < t; x += 1 / 60) {
      this.onFrame?.(x);
      this.tick(x, false);
    }
    this.onFrame?.(t);
    this.tick(t);
  }

  private tick(fixedT?: number, draw = true) {
    if (fixedT === undefined) this.clock.update();
    const t = fixedT ?? this.clock.getElapsed();
    const dt = fixedT === undefined ? Math.min(this.clock.getDelta() || 1 / 60, 0.05) : 1 / 60;
    if (fixedT === undefined) this.onFrame?.(t);
    const j = this.jose;
    const r = this.rig;
    const amb = this.opts.reducedMotion ? 0 : r.sway;

    // cuerpo
    const breathe = Math.sin(t * 2.2);
    const jit = r.jitter ? (Math.random() - 0.5) * r.jitter : 0;
    j.root.position.set(jit, breathe * 0.02 * amb + r.hop, 0);
    j.root.rotation.y = r.turn;
    j.body.rotation.z = Math.sin(t * 1.1) * 0.035 * amb + r.lean;
    const sq = r.stretch * (1 - Math.abs(breathe) * 0.01 * amb);
    j.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    if (this.shadowBlob) {
      const k = 1 - Math.min(r.hop, 0.6) * 0.7;
      this.shadowBlob.scale.set(k, 0.6 * k, 1);
    }

    // brazos (z = abrir hacia el lado, x negativo = hacia adelante)
    j.armL.rotation.set(r.armLx, 0, r.armLz);
    j.armR.rotation.set(r.armRx, 0, r.armRz);
    j.legL.rotation.x = r.hop * 0.8;
    j.legR.rotation.x = -r.hop * 0.8;

    // gorro y pompón con retraso
    j.hat.visible = r.hat > 0.01;
    j.hat.scale.setScalar(Math.max(0.001, r.hat));
    j.hat.rotation.z = HAT_TILT + Math.sin(t * 2.2 - 0.6) * 0.05 * amb - r.hop * 0.2;
    j.pompom.position.y = 0.63 + Math.sin(t * 2.2 - 1.2) * 0.02 * amb;
    j.scarfTail.rotation.z = 0.15 + Math.sin(t * 1.7) * 0.08 * amb;

    // humo 3D (solo vistas previas)
    if (this.smokeOn) {
      const smoke = j.body.getObjectByName('smoke');
      smoke?.children.forEach((puff, i) => {
        const c = (t * 0.45 + i / 3) % 1;
        puff.position.set(0.12 + Math.sin(c * 5 + i) * 0.08, 2.1 + c * 0.75, 0);
        puff.scale.setScalar(0.4 + c * 0.9);
        ((puff as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (r.lid > 0.9 ? 0.2 : 0.38) * Math.sin(c * Math.PI);
      });
    }

    // mirada
    this.look.lerp(new THREE.Vector2(r.lookX, r.lookY), 1 - Math.exp(-dt * 10));
    for (const p of j.pupils) {
      p.position.x = this.look.x * 0.035;
      p.position.y = -0.01 - this.look.y * 0.03;
    }
    j.head.rotation.y = this.look.x * 0.12;

    // cejas
    j.brows.forEach((b, i) => {
      const side = i === 0 ? -1 : 1;
      b.position.y = 0.175 + r.browLift;
      b.rotation.z = Math.PI / 2 + side * (-0.12 + r.browTilt);
    });

    // boca
    for (const k of Object.keys(j.mouths) as MouthShape[]) j.mouths[k].visible = k === r.mouth;

    // parpadeo automático
    if (t > this.nextBlink && this.blinkT < 0 && r.lid < 0.9) {
      this.blinkT = 0;
      this.nextBlink = t + 2.5 + Math.random() * 3;
    }
    let lid = r.lid;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const b = this.blinkT / 0.16;
      lid = Math.max(lid, b < 0.5 ? easeOut(b * 2) : easeOut(2 - b * 2));
      if (b >= 1) this.blinkT = -1;
    }
    for (const l of j.lids) {
      l.scale.y = Math.max(0.001, lid);
      l.visible = lid > 0.02;
    }

    // brasa
    const flick = 0.85 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23.7) * 0.05 + r.flare;
    j.emberLight.intensity = 1.2 * flick;
    const em = j.ember.material as THREE.MeshStandardMaterial;
    if (em.emissive) em.emissiveIntensity = 2.2 * flick;
    else em.color.setStyle('#FF5B3A').multiplyScalar(0.9 + flick * 0.15);

    if (draw) this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    this.ro?.disconnect();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
