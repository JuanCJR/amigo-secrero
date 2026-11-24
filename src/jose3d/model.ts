// José Miguel en 3D: modelo procedural con three.js.
// Estilo "Rifa": sombreado toon de 3 tonos + contorno negro tipo sticker.
// Cada pieza queda con nombre para poder animarla por separado.
import * as THREE from 'three';

export const PALETTE = {
  ink: '#111111',
  paper: '#FBF7EE',
  paperShade: '#E9E1CF',
  cork: '#E49A43',
  corkDot: '#B9702A',
  ash: '#6E6866',
  ember: '#FF5B3A',
  emberHot: '#FFD447',
  hat: '#FF5B3A',
  fur: '#FFFFFF',
  scarf: '#FFD447',
  scarfStripe: '#FF5B3A',
  shoe: '#FF5B3A',
  mouth: '#7A1F14',
  cheek: '#FF9C8A',
};

const OUTLINE = 0.018;

// ---------- materiales ----------
function toonRamp() {
  // 3 tonos: sombra, medio, luz. NearestFilter = bordes duros de dibujo animado.
  const data = new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
const RAMP = toonRamp();

export function toon(color: string, extra: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: RAMP, ...extra });
}

/** Contorno por casco invertido: el mismo mesh, inflado por la normal y dibujado por atrás. */
const outlineMat = new THREE.ShaderMaterial({
  uniforms: { thickness: { value: OUTLINE }, color: { value: new THREE.Color(PALETTE.ink) } },
  vertexShader: /* glsl */ `
    uniform float thickness;
    void main() {
      vec3 p = position + normalize(normal) * thickness;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    void main() { gl_FragColor = vec4(color, 1.0); }`,
  side: THREE.BackSide,
});

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, name?: string, outline = true) {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  if (outline) {
    const o = new THREE.Mesh(geo, outlineMat);
    o.name = (name || 'part') + ':outline';
    o.renderOrder = -1;
    m.add(o);
  }
  return m;
}

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- piezas ----------
export interface JoseParts {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group; // cara + gorro (se inclina para mirar)
  eyes: THREE.Group[];
  pupils: THREE.Object3D[];
  lids: THREE.Object3D[];
  brows: THREE.Object3D[];
  mouths: Record<'smile' | 'open' | 'oh', THREE.Object3D>;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  hat: THREE.Group;
  pompom: THREE.Object3D;
  scarfTail: THREE.Group;
  ember: THREE.Mesh;
  emberLight: THREE.PointLight;
}

const R = 0.34; // radio del cigarro
const BODY_H = 1.9;
const FILTER_H = 0.5;
const TOP = BODY_H; // y de la punta

function buildBody(parts: Partial<JoseParts>) {
  const body = new THREE.Group();
  body.name = 'body';

  // papel: costura vertical y fibras suaves
  const paperTex = canvasTexture(512, 256, (c) => {
    c.fillStyle = PALETTE.paper;
    c.fillRect(0, 0, 512, 256);
    c.strokeStyle = 'rgba(140,120,90,0.25)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(372, 0);
    c.lineTo(366, 256);
    c.stroke();
    c.strokeStyle = 'rgba(140,120,90,0.05)';
    c.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = 30 + i * 40;
      c.beginPath();
      c.moveTo(0, y);
      c.bezierCurveTo(130, y - 8, 260, y + 10, 512, y - 4);
      c.stroke();
    }
  });
  const paperH = BODY_H - FILTER_H;
  const paper = mesh(new THREE.CylinderGeometry(R, R, paperH, 48, 1, true), toon(PALETTE.paper, { map: paperTex }), 'paper');
  paper.position.y = FILTER_H + paperH / 2;
  body.add(paper);

  // filtro de corcho = "shorts"
  const corkTex = canvasTexture(256, 128, (c) => {
    c.fillStyle = PALETTE.cork;
    c.fillRect(0, 0, 256, 128);
    c.fillStyle = PALETTE.corkDot;
    for (let i = 0; i < 140; i++) {
      c.beginPath();
      c.arc(Math.random() * 256, Math.random() * 128, 1.5 + Math.random() * 2, 0, Math.PI * 2);
      c.fill();
    }
  });
  corkTex.wrapS = THREE.RepeatWrapping;
  corkTex.repeat.set(2, 1);
  const filter = mesh(new THREE.CylinderGeometry(R * 1.01, R * 1.01, FILTER_H, 48), toon(PALETTE.cork, { map: corkTex }), 'filter');
  filter.position.y = FILTER_H / 2;
  body.add(filter);
  // banda donde se junta el papel con el filtro
  const band = mesh(new THREE.CylinderGeometry(R * 1.03, R * 1.03, 0.05, 48), toon(PALETTE.ink), 'band', false);
  band.position.y = FILTER_H;
  body.add(band);

  // punta: ceniza + brasa
  const ash = mesh(new THREE.CylinderGeometry(R, R, 0.06, 48), toon(PALETTE.ash), 'ash');
  ash.position.y = TOP - 0.03;
  body.add(ash);
  const ember = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.8, 40),
    new THREE.MeshBasicMaterial({ color: PALETTE.ember }),
  );
  ember.name = 'ember';
  ember.rotation.x = -Math.PI / 2;
  ember.position.y = TOP + 0.002;
  body.add(ember);
  const emberCore = new THREE.Mesh(new THREE.CircleGeometry(R * 0.42, 32), new THREE.MeshBasicMaterial({ color: PALETTE.emberHot }));
  emberCore.rotation.x = -Math.PI / 2;
  emberCore.position.y = TOP + 0.004;
  body.add(emberCore);
  const emberLight = new THREE.PointLight(PALETTE.ember, 1.2, 1.6, 2);
  // hilo de humo: tres bolitas que suben (se animan en stage.ts)
  const smoke = new THREE.Group();
  smoke.name = 'smoke';
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.07 + i * 0.03, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#E8E4F0', transparent: true, opacity: 0.5, depthWrite: false }),
    );
    puff.position.set(0.12, TOP + 0.2 + i * 0.22, 0);
    smoke.add(puff);
  }
  body.add(smoke);
  emberLight.position.set(0, TOP + 0.15, 0.1);
  body.add(emberLight);
  parts.ember = ember;
  parts.emberLight = emberLight;

  return body;
}

function buildFace(parts: Partial<JoseParts>) {
  // la cara vive en la superficie frontal del cilindro (z = R)
  const head = new THREE.Group();
  head.name = 'head';
  const faceY = 1.32;

  const eyes: THREE.Group[] = [];
  const pupils: THREE.Object3D[] = [];
  const lids: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.name = side < 0 ? 'eyeL' : 'eyeR';
    const ang = side * 0.42;
    eye.position.set(Math.sin(ang) * R * 0.96, faceY, Math.cos(ang) * R * 0.96);
    eye.rotation.y = ang;

    const white = mesh(new THREE.SphereGeometry(0.1, 32, 24), toon('#FFFFFF'), 'white');
    white.scale.set(1, 1.2, 0.55);
    eye.add(white);

    const pupil = new THREE.Group();
    pupil.name = 'pupil';
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.052, 24, 16), new THREE.MeshBasicMaterial({ color: PALETTE.ink }));
    iris.scale.set(1, 1.1, 0.5);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), new THREE.MeshBasicMaterial({ color: '#FFFFFF' }));
    shine.position.set(0.018, 0.022, 0.024);
    pupil.add(iris, shine);
    pupil.position.set(0, -0.01, 0.045);
    eye.add(pupil);

    // párpado: elipsoide de papel que cae desde arriba (lid.scale.y 0 = abierto, 1 = cerrado)
    const lidPivot = new THREE.Group();
    lidPivot.name = 'lid';
    lidPivot.position.y = 0.122;
    const lid = mesh(new THREE.SphereGeometry(0.104, 32, 24), toon(PALETTE.paperShade), 'lidShell');
    lid.scale.set(1.04, 1.22, 0.82);
    lid.position.set(0, -0.122, 0.004);
    lidPivot.add(lid);
    lidPivot.scale.y = 0.001;
    eye.add(lidPivot);

    // ceja
    const brow = mesh(new THREE.CapsuleGeometry(0.014, 0.1, 4, 8), toon(PALETTE.ink), side < 0 ? 'browL' : 'browR', false);
    brow.rotation.z = Math.PI / 2 + side * -0.12;
    brow.position.set(0, 0.175, 0.03);
    eye.add(brow);

    head.add(eye);
    eyes.push(eye);
    pupils.push(pupil);
    lids.push(lidPivot);
    (parts.brows ||= []).push(brow);

    // mejilla
    const cheek = new THREE.Mesh(
      new THREE.CircleGeometry(0.05, 24),
      new THREE.MeshBasicMaterial({ color: PALETTE.cheek, transparent: true, opacity: 0.6 }),
    );
    const ca = side * 0.78;
    cheek.position.set(Math.sin(ca) * (R + 0.003), faceY - 0.15, Math.cos(ca) * (R + 0.003));
    cheek.rotation.y = ca;
    cheek.scale.y = 0.65;
    head.add(cheek);
  }

  // bocas (se muestra una a la vez)
  const mouthY = faceY - 0.2;
  const mouthMat = toon(PALETTE.mouth);
  const smile = mesh(new THREE.TorusGeometry(0.075, 0.016, 10, 24, Math.PI), mouthMat, 'mouthSmile', false);
  smile.rotation.z = Math.PI;
  smile.position.set(0, mouthY + 0.04, R + 0.005);
  const open = mesh(new THREE.SphereGeometry(0.075, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mouthMat, 'mouthOpen');
  open.scale.set(1, 1, 0.35);
  open.position.set(0, mouthY + 0.03, R - 0.005);
  const oh = mesh(new THREE.TorusGeometry(0.035, 0.016, 10, 24), mouthMat, 'mouthOh', false);
  oh.position.set(0, mouthY, R + 0.004);
  open.visible = false;
  oh.visible = false;
  head.add(smile, open, oh);

  parts.eyes = eyes;
  parts.pupils = pupils;
  parts.lids = lids;
  parts.mouths = { smile, open, oh };
  return head;
}

function buildHat(parts: Partial<JoseParts>) {
  const hat = new THREE.Group();
  hat.name = 'hat';

  // cono doblado: cilindro afinado cuyos vértices se curvan hacia un lado
  const H = 0.85;
  const HR = R * 0.82;
  const geo = new THREE.CylinderGeometry(0.03, HR, H, 40, 24);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) + H / 2; // 0..H
    const t = y / H;
    pos.setX(i, pos.getX(i) - t * t * 0.5);
    pos.setY(i, y - t * t * 0.22);
  }
  geo.computeVertexNormals();
  const cone = mesh(geo, toon(PALETTE.hat), 'hatCone');
  hat.add(cone);

  const brim = mesh(new THREE.TorusGeometry(HR, 0.07, 16, 48), toon(PALETTE.fur), 'hatBrim');
  brim.rotation.x = Math.PI / 2;
  hat.add(brim);

  const pompom = mesh(new THREE.IcosahedronGeometry(0.11, 2), toon(PALETTE.fur), 'pompom');
  pompom.position.set(-0.5, H - 0.22, 0);
  hat.add(pompom);

  // apoyado en el borde izquierdo, ladeado: la brasa asoma a la derecha
  hat.position.set(-0.2, TOP - 0.02, -0.02);
  hat.rotation.z = 0.42;
  hat.rotation.x = -0.1;
  parts.hat = hat;
  parts.pompom = pompom;
  return hat;
}

function stripedTexture() {
  const t = canvasTexture(256, 32, (c) => {
    c.fillStyle = PALETTE.scarf;
    c.fillRect(0, 0, 256, 32);
    c.fillStyle = PALETTE.scarfStripe;
    for (let x = 8; x < 256; x += 42) c.fillRect(x, 0, 12, 32);
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function buildScarf(parts: Partial<JoseParts>) {
  const g = new THREE.Group();
  g.name = 'scarf';
  const tex = stripedTexture();
  tex.repeat.set(3, 1);
  const wrap = mesh(new THREE.TorusGeometry(R + 0.03, 0.07, 16, 56), toon(PALETTE.scarf, { map: tex }), 'scarfWrap');
  wrap.rotation.x = Math.PI / 2;
  wrap.scale.set(1, 1, 1.25);
  g.add(wrap);

  const tail = new THREE.Group();
  tail.name = 'scarfTail';
  tail.position.set(R * 0.55, -0.02, R * 0.8);
  const tailTex = stripedTexture();
  tailTex.rotation = Math.PI / 2;
  tailTex.center.set(0.5, 0.5);
  const piece = mesh(new THREE.BoxGeometry(0.15, 0.42, 0.05), toon(PALETTE.scarf, { map: tailTex }), 'scarfPiece');
  piece.position.y = -0.21;
  tail.add(piece);
  tail.rotation.z = 0.15;
  tail.rotation.x = -0.12;
  g.add(tail);

  g.position.y = 0.92;
  parts.scarfTail = tail;
  return g;
}

function limb(points: THREE.Vector3[], radius: number) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, 24, radius, 10, false);
}

function buildArm(side: -1 | 1) {
  const arm = new THREE.Group();
  arm.name = side < 0 ? 'armL' : 'armR';
  arm.position.set(side * R * 0.95, 0.78, 0.06);
  const tube = mesh(
    limb([new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.18, -0.14, 0.03), new THREE.Vector3(side * 0.3, -0.42, 0.06)], 0.028),
    toon(PALETTE.ink),
    'armTube',
    false,
  );
  arm.add(tube);
  const hand = mesh(new THREE.SphereGeometry(0.075, 20, 16), toon(PALETTE.fur), 'hand');
  hand.position.set(side * 0.31, -0.46, 0.06);
  arm.add(hand);
  return arm;
}

function buildLeg(side: -1 | 1) {
  const leg = new THREE.Group();
  leg.name = side < 0 ? 'legL' : 'legR';
  leg.position.set(side * 0.14, 0.02, 0);
  const tube = mesh(limb([new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.02, -0.14, 0), new THREE.Vector3(side * 0.04, -0.26, 0)], 0.03), toon(PALETTE.ink), 'legTube', false);
  leg.add(tube);
  const shoe = mesh(new THREE.SphereGeometry(0.1, 20, 16), toon(PALETTE.shoe), 'shoe');
  shoe.scale.set(1, 0.55, 1.45);
  shoe.position.set(side * 0.05, -0.3, 0.06);
  leg.add(shoe);
  return leg;
}

/** Arma a José Miguel. Mide ~2.9 unidades de alto con gorro; los pies quedan en y = 0. */
export function buildJose(): JoseParts {
  const parts: Partial<JoseParts> = {};
  const root = new THREE.Group();
  root.name = 'jose';

  const body = buildBody(parts);
  const head = buildFace(parts);
  body.add(head);
  body.add(buildHat(parts));
  body.add(buildScarf(parts));
  const armL = buildArm(-1);
  const armR = buildArm(1);
  body.add(armL, armR);
  body.position.y = 0.3; // sobre las piernas
  root.add(body);

  const legL = buildLeg(-1);
  const legR = buildLeg(1);
  legL.position.y += 0.3;
  legR.position.y += 0.3;
  root.add(legL, legR);

  return {
    ...(parts as JoseParts),
    root,
    body,
    head,
    armL,
    armR,
    legL,
    legR,
  };
}
