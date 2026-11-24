// Escenario 3D de José Miguel: render, luces, cámara y animación por "ánimo".
// No depende de React; JoseCanvas.tsx lo envuelve.
import * as THREE from 'three';
import { buildJose, type JoseParts } from './model';

export type Mood3D = 'idle' | 'wave' | 'celebrate' | 'worried' | 'thinking' | 'sleep';

export interface StageOptions {
  /** Fondo transparente (para ponerlo sobre la UI). */
  transparent?: boolean;
  background?: string;
  /** Respeta prefers-reduced-motion: sin rebotes ni saltos, solo parpadeo. */
  reducedMotion?: boolean;
  /** Rotación fija en Y (radianes) para renders de vuelta completa. */
  yaw?: number;
  /** Conserva el último cuadro para poder capturarlo (renders fijos). */
  capture?: boolean;
  /** Sigue el puntero con la mirada. */
  followPointer?: boolean;
}

const HAT_TILT = 0.42;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export class JoseStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly jose: JoseParts;
  mood: Mood3D = 'idle';

  private clock = new THREE.Timer();
  private raf = 0;
  private moodStart = 0;
  private nextBlink = 1.5;
  private blinkT = -1;
  private look = new THREE.Vector2();
  private lookTarget = new THREE.Vector2();
  private opts: StageOptions;
  private ro?: ResizeObserver;

  constructor(private host: HTMLElement, opts: StageOptions = {}) {
    this.opts = opts;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !!opts.transparent, preserveDrawingBuffer: !!opts.capture });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (!opts.transparent) this.scene.background = new THREE.Color(opts.background || '#0F4A37');
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    this.camera.position.set(0, 2.6, 8.2);
    this.camera.lookAt(0, 1.3, 0);

    // luz: una principal dura (define el corte toon) + relleno suave + contraluz cálido
    this.scene.add(new THREE.HemisphereLight('#FFF6E0', '#0F4A37', 1.4));
    const key = new THREE.DirectionalLight('#FFFFFF', 2.6);
    key.position.set(2.5, 4, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#FFD447', 1.2);
    rim.position.set(-3, 2, -3);
    this.scene.add(rim);

    this.jose = buildJose();
    this.scene.add(this.jose.root);

    // sombra de contacto
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 40),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.y = 0.6;
    shadow.position.y = 0.001;
    shadow.name = 'shadow';
    this.scene.add(shadow);

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    if (opts.followPointer) window.addEventListener('pointermove', this.onPointer);
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.host.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
    const y = (e.clientY - (r.top + r.height * 0.4)) / window.innerHeight;
    this.lookTarget.set(THREE.MathUtils.clamp(x * 2, -1, 1), THREE.MathUtils.clamp(y * 2, -1, 1));
  };

  resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setMood(m: Mood3D) {
    if (m === this.mood) return;
    this.mood = m;
    this.moodStart = this.clock.getElapsed();
  }

  /** Mirada manual (-1..1); útil para apuntar a un botón. */
  lookAt(x: number, y: number) {
    this.lookTarget.set(x, y);
  }

  blink() {
    this.blinkT = 0;
  }

  start() {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  /** Avanza la animación hasta t segundos y dibuja un cuadro (para renders fijos). */
  renderAt(t: number) {
    // simula desde 0 para que las transiciones suavizadas lleguen a su pose
    this.moodStart = 0;
    for (let x = 0; x < t; x += 1 / 60) this.tick(x, false);
    this.tick(t);
  }

  private tick(fixedT?: number, draw = true) {
    if (fixedT === undefined) this.clock.update();
    const t = fixedT ?? this.clock.getElapsed();
    const dt = fixedT === undefined ? Math.min(this.clock.getDelta() || 1 / 60, 0.05) : 1 / 60;
    const j = this.jose;
    const reduced = !!this.opts.reducedMotion;
    const mt = t - this.moodStart;

    // reposo
    let bob = reduced ? 0 : Math.sin(t * 2.2) * 0.025;
    let sway = reduced ? 0 : Math.sin(t * 1.1) * 0.035;
    let armL = -0.12, armR = 0.12, armLx = 0, armRx = 0;
    let jump = 0;
    let browLift = 0, browTilt = 0;
    let mouth: 'smile' | 'open' | 'oh' = 'smile';
    let lidBase = 0;
    let headTurn = 0;

    switch (this.mood) {
      case 'wave': {
        armR = 2.0 + Math.sin(t * 12) * 0.3;
        mouth = 'open';
        browLift = 0.02;
        break;
      }
      case 'celebrate': {
        const p = (mt * 1.6) % 1;
        jump = reduced ? 0 : Math.sin(p * Math.PI) * 0.35;
        armL = -2.05;
        armR = 2.05;
        mouth = 'open';
        browLift = 0.035;
        break;
      }
      case 'worried': {
        armL = -0.9;
        armR = 0.9;
        armLx = -0.7;
        armRx = -0.7;
        browTilt = -0.35;
        mouth = 'oh';
        sway *= 0.4;
        break;
      }
      case 'thinking': {
        armR = 1.2;
        armRx = -1.4;
        headTurn = 0.25;
        this.lookTarget.set(0.6, -0.7);
        browTilt = -0.2;
        break;
      }
      case 'sleep': {
        lidBase = 1;
        bob = Math.sin(t * 1.2) * 0.015;
        sway = 0;
        mouth = 'oh';
        break;
      }
    }

    // cuerpo
    j.root.position.y = bob + jump;
    j.root.rotation.y = (this.opts.yaw ?? 0) + headTurn * 0.4;
    j.body.rotation.z = sway;
    const squash = jump > 0.01 ? 1 + jump * 0.12 : 1 - Math.abs(Math.sin(t * 2.2)) * (reduced ? 0 : 0.012);
    j.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    const sh = this.scene.getObjectByName('shadow');
    if (sh) sh.scale.set(1 - jump * 0.6, 0.6 * (1 - jump * 0.6), 1);

    // brazos (z = abrir hacia el lado, x = adelante)
    const k = 1 - Math.exp(-dt * 12);
    j.armL.rotation.z += (armL - j.armL.rotation.z) * k;
    j.armR.rotation.z += (armR - j.armR.rotation.z) * k;
    j.armL.rotation.x += (armLx - j.armL.rotation.x) * k;
    j.armR.rotation.x += (armRx - j.armR.rotation.x) * k;

    // piernas: pequeño paso al saltar
    j.legL.rotation.x = jump * 0.8;
    j.legR.rotation.x = -jump * 0.8;

    // gorro y pompón con retraso
    j.hat.rotation.z = HAT_TILT + Math.sin(t * 2.2 - 0.6) * (reduced ? 0 : 0.05) - jump * 0.2;
    j.pompom.position.y = 0.63 + Math.sin(t * 2.2 - 1.2) * (reduced ? 0 : 0.02);
    j.scarfTail.rotation.z = 0.15 + Math.sin(t * 1.7) * (reduced ? 0 : 0.08);

    // humo: cada bolita sube, crece y se desvanece en ciclo
    const smoke = j.body.getObjectByName('smoke');
    smoke?.children.forEach((puff, i) => {
      const c = (t * 0.45 + i / 3) % 1;
      puff.position.set(0.12 + Math.sin(c * 5 + i) * 0.08, 2.1 + c * 0.75, 0);
      puff.scale.setScalar(0.4 + c * 0.9);
      ((puff as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (this.mood === 'sleep' ? 0.2 : 0.38) * Math.sin(c * Math.PI);
    });

    // mirada
    if (this.mood !== 'thinking' && !this.opts.followPointer) this.lookTarget.lerp(new THREE.Vector2(0, 0), 0.02);
    this.look.lerp(this.lookTarget, 1 - Math.exp(-dt * 8));
    for (const p of j.pupils) {
      p.position.x = this.look.x * 0.035;
      p.position.y = -0.01 - this.look.y * 0.03;
    }
    j.head.rotation.y = this.look.x * 0.12 + headTurn;

    // cejas
    j.brows.forEach((b, i) => {
      const side = i === 0 ? -1 : 1;
      b.position.y = 0.175 + browLift;
      b.rotation.z = Math.PI / 2 + side * (-0.12 + browTilt);
    });

    // boca
    (Object.keys(j.mouths) as Array<keyof typeof j.mouths>).forEach((k2) => (j.mouths[k2].visible = k2 === mouth));

    // parpadeo
    if (t > this.nextBlink && this.blinkT < 0 && lidBase < 1) {
      this.blinkT = 0;
      this.nextBlink = t + 2.5 + Math.random() * 3;
    }
    let lid = lidBase;
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
    const flick = 0.85 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23.7) * 0.05;
    j.emberLight.intensity = 1.2 * flick;
    (j.ember.material as THREE.MeshBasicMaterial).color.setStyle('#FF5B3A').multiplyScalar(0.9 + flick * 0.15);

    if (draw) this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener('pointermove', this.onPointer);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
