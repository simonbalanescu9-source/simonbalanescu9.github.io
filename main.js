// ========== BASIC SETUP ==========
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(0, 1.6, 8);
scene.add(camera); // so we can parent the gun to the camera

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
document.body.appendChild(renderer.domElement);

// start in FPS mode: no OS cursor (CSS may or may not use this class)
document.body.classList.remove("show-cursor");

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(6, 10, 4);
scene.add(dirLight);

// ========== UI ==========
const moneyText   = document.getElementById("money");
const cartText    = document.getElementById("cart");
const listText    = document.getElementById("list");
const toastEl     = document.getElementById("toast");
const musicBtn    = document.getElementById("musicBtn");
const molotovText = document.getElementById("molotovs");
const weaponText  = document.getElementById("weapon");

// shop UI
const shopPanel     = document.getElementById("shopPanel");
const btnBuyMolotov = document.getElementById("btnBuyMolotov");
const btnBuyAK      = document.getElementById("btnBuyAK");
const btnCloseShop  = document.getElementById("btnCloseShop");

function toast(msg){
  // Safe: don’t crash if #toast is missing
  if (!toastEl) {
    console.log("[TOAST]", msg);
    return;
  }
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove("show"), 1300);
}

// ========== SIMPLE MUSIC ==========
let audioCtx = null;
let osc = null;
let gain = null;
let musicOn = false;

function startMusic(){
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (musicOn) return;

  gain = audioCtx.createGain();
  gain.gain.value = 0.03;
  gain.connect(audioCtx.destination);

  osc = audioCtx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 220;
  osc.connect(gain);
  osc.start();

  musicOn = true;
  if (musicBtn) musicBtn.textContent = "🔇 Music: On";
}

function stopMusic(){
  if (!musicOn) return;
  osc.stop();
  osc.disconnect();
  gain.disconnect();
  musicOn = false;
  if (musicBtn) musicBtn.textContent = "🔊 Music: Off";
}

if (musicBtn) {
  musicBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!audioCtx) {
      startMusic();
    } else {
      musicOn ? stopMusic() : startMusic();
    }
  });
}

// ========== INPUT (KEYBOARD / MOUSE) ==========
const keys = {};

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  keys[key] = true;

  if (key === "e") {
    handleInteract();
  } else if (key === "f") {
    handleMug();
  } else if (e.code === "Space") {
    handleJump();
  } else if (key === "r") {
    throwMolotov();
  }
});

document.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  keys[k] = false;
});

// Mouse look (desktop)
let yaw = 0;
let pitch = 0;

// Jump / gravity
let verticalVelocity = 0;
const GROUND_Y = 1.6;
const GRAVITY  = -20;
const JUMP_SPEED = 7;

// SHOP STATE
let shopOpen = false;

// Pointer lock change -> toggle cursor class
document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (locked && !shopOpen) {
    document.body.classList.remove("show-cursor");
  } else {
    document.body.classList.add("show-cursor");
  }
});

// Click on canvas: lock pointer or shoot
renderer.domElement.addEventListener("click", (e) => {
  if (
    shopOpen ||
    e.target.closest("#shopPanel") ||
    e.target.closest("#ui") ||
    e.target.closest("#touchControls") ||
    e.target.closest("#lookControls")
  ) {
    return;
  }

  // avoid pointer lock / shooting on mobile
  if (/Mobi|Android/i.test(navigator.userAgent)) return;

  if (document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
    return;
  }

  if (e.button === 0) {
    shootAK();
  }
});

document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  const sens = 0.0022;
  yaw   -= e.movementX * sens;
  pitch -= e.movementY * sens;
  pitch = Math.max(-1.2, Math.min(1.2, pitch));
  camera.rotation.set(pitch, yaw, 0, "YXZ");
});

// Touch drag look (phones / tablets)
let touchLookActive = false;
let lastTouchX = 0;
let lastTouchY = 0;
const lookSensitivity = 0.0022;

renderer.domElement.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) return;
  touchLookActive = true;
  lastTouchX = e.touches[0].clientX;
  lastTouchY = e.touches[0].clientY;
});

renderer.domElement.addEventListener("touchmove", (e) => {
  if (!touchLookActive || e.touches.length !== 1) return;
  const t = e.touches[0];

  const dx = t.clientX - lastTouchX;
  const dy = t.clientY - lastTouchY;
  lastTouchX = t.clientX;
  lastTouchY = t.clientY;

  yaw   -= dx * lookSensitivity;
  pitch -= dy * lookSensitivity;
  pitch = Math.max(-1.2, Math.min(1.2, pitch));
  camera.rotation.set(pitch, yaw, 0, "YXZ");

  e.preventDefault();
});

renderer.domElement.addEventListener("touchend", () => {
  touchLookActive = false;
});
renderer.domElement.addEventListener("touchcancel", () => {
  touchLookActive = false;
});

// ========== GAME DATA & COLLECTIONS ==========
let money = 20;
let cartTotal = 0;
let molotovs = 0;
let hasAK = false;
let ammo  = 0;

const list = { Apple: 2, Milk: 1, Cereal: 1 };
const bought = { Apple: 0, Milk: 0, Cereal: 0 };

const MOLOTOV_COST = 15;
const AK_COST      = 30;

const items = [];
const npcs = [];
const molotovsThrown = [];
const bullets = [];
const clouds = [];
const pigs   = [];
let pigSpawnTimer = 6 + Math.random() * 10;

let vendingMachine = null;
let gorilla = null;
let gorillaSpeech = null;
let gorillaTimer = null;
let gorillaActive = false;

// ========== FLOOR ==========
const floorSize = 40;
const tileCanvas = document.createElement("canvas");
tileCanvas.width = 1024;
tileCanvas.height = 1024;
const tctx = tileCanvas.getContext("2d");

tctx.fillStyle = "#f4f4f4";
tctx.fillRect(0, 0, tileCanvas.width, tileCanvas.height);

tctx.strokeStyle = "#d0d0d0";
tctx.lineWidth = 2;
const tiles = 16;
const step = tileCanvas.width / tiles;

for (let i = 0; i <= tiles; i++) {
  tctx.beginPath();
  tctx.moveTo(i * step, 0);
  tctx.lineTo(i * step, tileCanvas.height);
  tctx.stroke();

  tctx.beginPath();
  tctx.moveTo(0, i * step);
  tctx.lineTo(tileCanvas.width, i * step);
  tctx.stroke();
}

const floorTex = new THREE.CanvasTexture(tileCanvas);
floorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

const floorMat = new THREE.MeshStandardMaterial({
  map: floorTex,
  roughness: 0.95,
  metalness: 0.0
});

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(floorSize, floorSize),
  floorMat
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// ========== SANTA WALL PATTERN ==========
const santaCanvas = document.createElement("canvas");
santaCanvas.width = 512;
santaCanvas.height = 512;
const sctx = santaCanvas.getContext("2d");

sctx.fillStyle = "#c41420";
sctx.fillRect(0, 0, santaCanvas.width, santaCanvas.height);

sctx.strokeStyle = "#ffffff";
sctx.lineWidth = 16;
for (let i = -512; i < 512; i += 80) {
  sctx.beginPath();
  sctx.moveTo(i, 0);
  sctx.lineTo(i + 512, 512);
  sctx.stroke();
}

function drawSantaFace(x, y) {
  sctx.fillStyle = "#ffe0c4";
  sctx.beginPath();
  sctx.arc(x, y, 36, 0, Math.PI * 2);
  sctx.fill();

  sctx.fillStyle = "#b00012";
  sctx.beginPath();
  sctx.moveTo(x - 40, y - 10);
  sctx.lineTo(x + 40, y - 10);
  sctx.lineTo(x, y - 70);
  sctx.closePath();
  sctx.fill();

  sctx.fillStyle = "#ffffff";
  sctx.fillRect(x - 42, y - 16, 84, 12);

  sctx.beginPath();
  sctx.moveTo(x - 40, y + 10);
  sctx.quadraticCurveTo(x, y + 55, x + 40, y + 10);
  sctx.quadraticCurveTo(x, y + 75, x - 40, y + 10);
  sctx.fill();

  sctx.fillStyle = "#000000";
  sctx.beginPath();
  sctx.arc(x - 12, y - 5, 4, 0, Math.PI * 2);
  sctx.arc(x + 12, y - 5, 4, 0, Math.PI * 2);
  sctx.fill();

  sctx.fillStyle = "#ffb199";
  sctx.beginPath();
  sctx.arc(x, y + 5, 5, 0, Math.PI * 2);
  sctx.fill();
}

const cols = 3;
const rows = 3;
for (let i = 0; i < cols; i++) {
  for (let j = 0; j < rows; j++) {
    const x = (i + 0.5) * (santaCanvas.width / cols);
    const y = (j + 0.5) * (santaCanvas.height / rows);
    drawSantaFace(x, y);
  }
}

const santaTex = new THREE.CanvasTexture(santaCanvas);
santaTex.wrapS = THREE.RepeatWrapping;
santaTex.wrapT = THREE.RepeatWrapping;
santaTex.repeat.set(2, 1);

const santaWallMat = new THREE.MeshStandardMaterial({
  map: santaTex,
  roughness: 0.95,
  metalness: 0.0
});

// ========== WALLS ==========
function wall(w,h,d,x,y,z){
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w,h,d),
    santaWallMat
  );
  m.position.set(x,y,z);
  scene.add(m);
}

wall(40,4,0.5, 0,2, -20);
wall(40,4,0.5, 0,2,  20);
wall(0.5,4,40, -20,2, 0);
wall(0.5,4,40,  20,2, 0);

// ========== METAL PIPES POSTERS ==========
function createPoster(x, y, z, rotY = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // yellow background
  ctx.fillStyle = "#ffd700";
  ctx.fillRect(0, 0, 512, 512);

  // black border
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, 496, 496);

  // title text
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "900 84px Arial";
  ctx.fillText("METAL", 256, 210);
  ctx.fillText("PIPES", 256, 310);

  ctx.font = "bold 28px Arial";
  ctx.fillText("STRONG • LOUD • RELIABLE", 256, 395);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0x222222),
    emissiveIntensity: 0.6
  });

  const poster = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), mat);
  poster.position.set(x, y, z);
  poster.rotation.y = rotY;
  scene.add(poster);
}

// same placements as your old script
createPoster( 0,   2.2, -18.8,  0);
createPoster(-18.8,2.2,   0,    Math.PI/2);
createPoster( 18.8,2.2,   4,   -Math.PI/2);
createPoster( 10,  2.2, 18.8,  Math.PI);

// ========== FISHING POSTER ==========
function createFishingPoster(x, y, z, rotY = 0){
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#4fa9ff";
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = "#002347";
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, 496, 496);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 60px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Fishing", 256, 170);
  ctx.fillText("Vacation!", 256, 260);

  ctx.font = "900 32px Arial";
  ctx.fillText("bloxdapp.github.io", 256, 345);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0x003366),
    emissiveIntensity: 0.6
  });

  const poster = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), mat);
  poster.position.set(x, y, z);
  poster.rotation.y = rotY;
  scene.add(poster);
}

// same spot as before
createFishingPoster(-10, 2.2, 18.8, Math.PI);

// ========== CHECKOUT COUNTER & ZONE ==========
const counter = new THREE.Mesh(
  new THREE.BoxGeometry(6, 1.1, 2),
  new THREE.MeshStandardMaterial({ color: 0xdadada })
);
counter.position.set(-14, 0.55, 14);
scene.add(counter);

const checkoutZone = new THREE.Mesh(
  new THREE.BoxGeometry(5, 0.1, 5),
  new THREE.MeshStandardMaterial({ color: 0x88ff88, transparent: true, opacity: 0.22 })
);
checkoutZone.position.set(-14, 0.05, 10);
scene.add(checkoutZone);

// ========== CASHIER ==========
let cashier = null;

function createCashier(x, z) {
  const cashierGroup = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0xfff3d1 })
  );
  body.scale.y = 1.4;
  cashierGroup.add(body);

  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const eyeBlackMat = new THREE.MeshStandardMaterial({ color: 0x000000 });

  const leftEyeWhite = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 16, 16),
    eyeWhiteMat
  );
  const rightEyeWhite = leftEyeWhite.clone();
  leftEyeWhite.position.set(-0.16, 0.25, 0.45);
  rightEyeWhite.position.set(0.16, 0.25, 0.45);
  cashierGroup.add(leftEyeWhite, rightEyeWhite);

  const leftPupil = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 12, 12),
    eyeBlackMat
  );
  const rightPupil = leftPupil.clone();
  leftPupil.position.set(-0.16, 0.24, 0.50);
  rightPupil.position.set(0.16, 0.24, 0.50);
  cashierGroup.add(leftPupil, rightPupil);

  const mouth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  mouth.rotation.x = Math.PI / 2;
  mouth.position.set(0, 0.12, 0.50);
  cashierGroup.add(mouth);

  cashierGroup.rotation.y = Math.PI;
  cashierGroup.position.set(x, 0.55, z);
  scene.add(cashierGroup);

  return cashierGroup;
}

cashier = createCashier(-14, 13);

// ========== SHELVES ==========
function shelf(x, z, length = 14){
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.6, length),
    new THREE.MeshStandardMaterial({ color: 0xc9b48a })
  );
  base.position.set(x, 0.8, z);
  scene.add(base);

  for (let i = 0; i < 4; i++){
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.08, length),
      new THREE.MeshStandardMaterial({ color: 0xb99f6e })
    );
    slat.position.set(x, 0.25 + i * 0.45, z);
    scene.add(slat);
  }
}
shelf(-6, -6, 14);
shelf( 0, -6, 14);
shelf( 6, -6, 14);
shelf(-6,  6, 14);
shelf( 0,  6, 14);
shelf( 6,  6, 14);

// ========== GUN (VIEWMODEL) ==========
let gun = null;
let gunMuzzle = null;

function createGun(){
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.3 })
  );
  body.position.set(0, 0, -0.2);
  group.add(body);

  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 })
  );
  barrel.position.set(0, 0, -0.8);
  group.add(barrel);

  const stock = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.25, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  stock.position.set(0, -0.02, 0.35);
  group.add(stock);

  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.3, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );
  grip.position.set(0.05, -0.3, -0.1);
  group.add(grip);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -1.15);
  group.add(muzzle);

  group.position.set(0.5, -0.35, -0.8);
  group.rotation.set(-0.1, 0, 0);

  group.visible = false;
  camera.add(group);

  gun = group;
  gunMuzzle = muzzle;
}
createGun();

function updateGunVisibility(){
  if (!gun) return;
  gun.visible = hasAK;
}

// ========== UI UPDATE ==========
function updateUI(){
  if (moneyText) {
    moneyText.textContent = `Money: $${money}`;
  }
  if (cartText) {
    cartText.textContent  = `Cart: ${cartTotal === 0 ? "$0" : "$" + cartTotal}`;
  }
  if (molotovText) {
    molotovText.textContent = `Molotovs: ${molotovs}`;
  }
  if (weaponText) {
    weaponText.textContent = hasAK
      ? `Weapon: AK-47 (${ammo} ammo)`
      : "Weapon: None";
  }
  if (listText) {
    const parts = Object.keys(list).map(
      k => `${k} x${Math.max(0, list[k] - bought[k])}`
    );
    listText.textContent = `List: ${parts.join(", ")}`;
  }

  updateGunVisibility();
}
updateUI();

// ========== ITEMS ==========
const itemMat = (color) => new THREE.MeshStandardMaterial({ color });

function createItem(name, price, x, y, z, color, paid=false){
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5), itemMat(color));
  mesh.position.set(x, y, z);
  mesh.userData = { type:"item", name, price, paid };
  scene.add(mesh);
  items.push(mesh);
}

createItem("Apple",  3, -6, 1.15, -10, 0xff4d4d);
createItem("Apple",  3,  0, 1.15, -10, 0xff4d4d);
createItem("Milk",   5,  6, 1.15,  -2, 0xffffff);
createItem("Cereal", 7, -6, 0.70,   2, 0xffcc33);
createItem("Juice",  4,  0, 0.70,   2, 0xff8844);
createItem("Bread",  2,  6, 0.70, -10, 0xd2a679);

// ========== NPC SHOPPERS ==========
function createNPC(x, z, shirtColor = 0x88aaff) {
  const npc = new THREE.Group();

  const legMat = new THREE.MeshStandardMaterial({ color: 0x333366 });
  const legGeo = new THREE.BoxGeometry(0.18, 0.8, 0.18);

  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.12, 0.4, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.12;
  npc.add(leftLeg, rightLeg);

  const bodyGeo = new THREE.BoxGeometry(0.6, 0.9, 0.3);
  const bodyMat = new THREE.MeshStandardMaterial({ color: shirtColor });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 1.25, 0);
  npc.add(body);

  const armGeo = new THREE.BoxGeometry(0.16, 0.7, 0.16);
  const armMat = new THREE.MeshStandardMaterial({ color: shirtColor });
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.4, 1.25, 0);
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.4;
  npc.add(leftArm, rightArm);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffe0bd })
  );
  head.position.set(0, 2.0, 0);
  npc.add(head);

  const eyeGeo = new THREE.SphereGeometry(0.03, 12, 12);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
  leftEye.position.set(-0.06, 2.04, 0.23);
  rightEye.position.set(0.06, 2.04, 0.23);
  npc.add(leftEye, rightEye);

  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.04, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x552222 })
  );
  mouth.position.set(0, 1.93, 0.24);
  npc.add(mouth);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x332211 })
  );
  hair.position.set(0, 2.05, 0);
  npc.add(hair);

  npc.position.set(x, 0, z);

  npc.userData = {
    dir: Math.random() > 0.5 ? 1 : -1,
    speed: 0.8 + Math.random() * 0.6,
    wallet: 8
  };

  scene.add(npc);
  npcs.push(npc);
  return npc;
}

createNPC(-10, -4);
createNPC(4, -8, 0xaaffaa);
createNPC(10, 5, 0xffaaaa);

// ========== SKY CLOUDS ==========
function createCloud(x, z){
  const cloud = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.0
  });

  const a = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), mat);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 16), mat);
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), mat);

  b.position.set(1.1, 0.2,  0.1);
  c.position.set(-1.0, 0.1, -0.1);

  cloud.add(a, b, c);

  const y = 8 + Math.random() * 2;
  cloud.position.set(x, y, z);

  cloud.userData = {
    speed: 0.8 + Math.random() * 0.7,
    dir:   Math.random() > 0.5 ? 1 : -1
  };

  scene.add(cloud);
  clouds.push(cloud);
}

// initial clouds
for (let i = 0; i < 7; i++){
  const x = -18 + Math.random() * 36;
  const z = -12 + Math.random() * 24;
  createCloud(x, z);
}

// ========== FLYING PIGS ==========
function createFlyingPig(fromLeft){
  const pig = new THREE.Group();

  const pink  = new THREE.MeshStandardMaterial({ color: 0xffa4c4, roughness: 0.7, metalness: 0.1 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const black = new THREE.MeshStandardMaterial({ color: 0x000000 });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.8, 0.6),
    pink
  );
  pig.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.6, 0.6),
    pink
  );
  head.position.set(0.8, 0.1, 0);
  pig.add(head);

  const snout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.25, 12),
    pink
  );
  snout.rotation.z = Math.PI / 2;
  snout.position.set(1.25, 0.05, 0);
  pig.add(snout);

  const eyeGeo = new THREE.SphereGeometry(0.06, 12, 12);
  const leftEye  = new THREE.Mesh(eyeGeo, black);
  const rightEye = new THREE.Mesh(eyeGeo, black);
  leftEye.position.set(0.95, 0.23,  0.15);
  rightEye.position.set(0.95, 0.23, -0.15);
  pig.add(leftEye, rightEye);

  const earGeo = new THREE.BoxGeometry(0.2, 0.35, 0.1);
  const leftEar  = new THREE.Mesh(earGeo, pink);
  const rightEar = new THREE.Mesh(earGeo, pink);
  leftEar.position.set(0.7, 0.5,  0.18);
  rightEar.position.set(0.7, 0.5, -0.18);
  pig.add(leftEar, rightEar);

  const wingGeo = new THREE.BoxGeometry(0.1, 0.4, 0.8);
  const leftWing  = new THREE.Mesh(wingGeo, white);
  const rightWing = new THREE.Mesh(wingGeo, white);
  leftWing.position.set(0, 0.3,  0.5);
  rightWing.position.set(0, 0.3, -0.5);
  pig.add(leftWing, rightWing);

  const dir    = fromLeft ? 1 : -1;
  const startX = fromLeft ? -24 : 24;
  const startZ = -4 + Math.random() * 8;
  const baseY  = 7  + Math.random() * 2;

  pig.position.set(startX, baseY, startZ);
  pig.userData = {
    dir,
    speed: 6 + Math.random() * 2,
    baseY,
    phase: Math.random() * Math.PI * 2
  };

  pig.rotation.y = fromLeft ? 0 : Math.PI;

  scene.add(pig);
  pigs.push(pig);
}

// ========== VENDING MACHINE 2.0 (MORE REALISTIC) ==========
function createSodaCanMesh({ glow = false } = {}) {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 256;
  labelCanvas.height = 128;
  const lctx = labelCanvas.getContext("2d");

  const grad = lctx.createLinearGradient(0, 0, 256, 128);
  grad.addColorStop(0, "#ff3b3b");
  grad.addColorStop(1, "#ff9a3b");
  lctx.fillStyle = grad;
  lctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);

  lctx.fillStyle = "rgba(255,255,255,0.25)";
  lctx.beginPath();
  lctx.moveTo(-20, 20);
  lctx.quadraticCurveTo(120, -10, 276, 40);
  lctx.quadraticCurveTo(120, 80, -20, 50);
  lctx.closePath();
  lctx.fill();

  lctx.fillStyle = "#ffffff";
  lctx.font = "bold 42px Arial";
  lctx.textAlign = "center";
  lctx.textBaseline = "middle";
  lctx.fillText("ZOOM COLA", 128, 64);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.85,
    roughness: 0.25
  });

  const bodyMat = new THREE.MeshStandardMaterial({
    map: labelTex,
    metalness: 0.4,
    roughness: 0.35,
    emissive: glow ? new THREE.Color(0xff5533) : new THREE.Color(0x000000),
    emissiveIntensity: glow ? 0.4 : 0.0
  });

  const can = new THREE.Group();

  const side = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.7, 24, 1, true),
    bodyMat
  );
  can.add(side);

  const topCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24),
    metalMat
  );
  topCap.position.y = 0.35;
  can.add(topCap);

  const bottomCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24),
    metalMat
  );
  bottomCap.position.y = -0.35;
  can.add(bottomCap);

  const tab = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.01, 0.05),
    metalMat
  );
  tab.position.set(0.07, 0.37, 0);
  can.add(tab);

  return can;
}

function createVendingMachine(x, z){
  const vm = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 2.2, 0.9),
    new THREE.MeshStandardMaterial({
      color: 0x273c75,
      metalness: 0.4,
      roughness: 0.55
    })
  );
  body.position.y = 1.1;
  vm.add(body);

  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.7, 0.05),
    new THREE.MeshStandardMaterial({
      color: 0x101525,
      metalness: 0.55,
      roughness: 0.4
    })
  );
  doorFrame.position.set(-0.15, 1.2, 0.46);
  vm.add(doorFrame);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 1.6, 0.03),
    new THREE.MeshStandardMaterial({
      color: 0x88cfff,
      transparent: true,
      opacity: 0.25,
      metalness: 0.1,
      roughness: 0.05
    })
  );
  glass.position.set(-0.15, 1.2, 0.475);
  vm.add(glass);

  const shelves = 4;
  const cols = 3;
  for (let r = 0; r < shelves; r++) {
    const shelfY = 1.6 - r * 0.42;

    const shelfBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.02, 0.6),
      new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        metalness: 0.5,
        roughness: 0.5
      })
    );
    shelfBoard.position.set(-0.15, shelfY - 0.2, 0.35);
    vm.add(shelfBoard);

    for (let c = 0; c < cols; c++) {
      const can = createSodaCanMesh({ glow: false });
      can.position.set(-0.32 + c * 0.3, shelfY, 0.35);
      vm.add(can);
    }
  }

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 1.2, 0.06),
    new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.6,
      roughness: 0.4
    })
  );
  panel.position.set(0.45, 1.25, 0.45);
  vm.add(panel);

  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 256;
  screenCanvas.height = 128;
  const scrCtx = screenCanvas.getContext("2d");
  scrCtx.fillStyle = "#003322";
  scrCtx.fillRect(0, 0, 256, 128);
  scrCtx.fillStyle = "#33ff99";
  scrCtx.font = "bold 34px Arial";
  scrCtx.textAlign = "center";
  scrCtx.textBaseline = "middle";
  scrCtx.fillText("SODA $5", 128, 60);
  const screenTex = new THREE.CanvasTexture(screenCanvas);

  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.16, 0.02),
    new THREE.MeshStandardMaterial({
      map: screenTex,
      emissive: new THREE.Color(0x009966),
      emissiveIntensity: 0.8
    })
  );
  screen.position.set(0.45, 1.55, 0.48);
  vm.add(screen);

  const keyMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const keyGeo = new THREE.BoxGeometry(0.06, 0.04, 0.02);
  const startY = 1.30;
  const startX = 0.37;
  const keyGap = 0.07;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const key = new THREE.Mesh(keyGeo, keyMat);
      key.position.set(
        startX + col * keyGap,
        startY - row * keyGap,
        0.48
      );
      vm.add(key);
    }
  }

  const coinSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.03, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 })
  );
  coinSlot.position.set(0.45, 0.98, 0.48);
  vm.add(coinSlot);

  const pickup = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.2, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0x050505,
      metalness: 0.3,
      roughness: 0.6
    })
  );
  pickup.position.set(-0.15, 0.5, 0.47);
  vm.add(pickup);

  const topCanvas = document.createElement("canvas");
  topCanvas.width = 512;
  topCanvas.height = 128;
  const tctx2 = topCanvas.getContext("2d");
  tctx2.fillStyle = "#000000";
  tctx2.fillRect(0, 0, 512, 128);
  tctx2.fillStyle = "#ff66ff";
  tctx2.font = "bold 52px Arial";
  tctx2.textAlign = "center";
  tctx2.textBaseline = "middle";
  tctx2.fillText("FIZZY FRIEND", 256, 64);
  const topTex = new THREE.CanvasTexture(topCanvas);

  const topSign = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.25, 0.08),
    new THREE.MeshStandardMaterial({
      map: topTex,
      emissive: new THREE.Color(0xff44ff),
      emissiveIntensity: 0.7
    })
  );
  topSign.position.set(0, 2.3, 0.42);
  vm.add(topSign);

  const glowLight = new THREE.PointLight(0x55ccff, 0.3, 6);
  glowLight.position.set(x, 2.0, z + 0.4);
  scene.add(glowLight);

  vm.position.set(x, 0, z);
  vm.rotation.y = Math.PI;

  scene.add(vm);
  return vm;
}

vendingMachine = createVendingMachine(14, 5);

function spawnVendingDrink(x, y, z){
  const drink = createSodaCanMesh({ glow: true });
  drink.position.set(x, y, z);

  drink.userData = {
    type: "item",
    name: "Soda",
    price: 0,
    paid: true
  };

  scene.add(drink);
  items.push(drink);
}

function nearVending(maxDistance = 2.5){
  if (!vendingMachine) return false;
  const dx = camera.position.x - vendingMachine.position.x;
  const dz = camera.position.z - vendingMachine.position.z;
  return (dx*dx + dz*dz) < maxDistance * maxDistance;
}

function useVendingMachine(){
  const cost = 5;
  if (money < cost){
    toast("Vending machine costs $5. Not enough money.");
    return;
  }
  money -= cost;

  const forward = new THREE.Vector3(0, 0, -1).applyEuler(vendingMachine.rotation);
  const spawnPos = vendingMachine.position.clone().add(forward.multiplyScalar(1.0));
  spawnPos.y = 0.6;

  spawnVendingDrink(spawnPos.x, spawnPos.y, spawnPos.z);

  updateUI();
  toast("🥤 A funny soda drops out!");
}

// ========== RAYCAST / HELPERS ==========
const raycaster = new THREE.Raycaster();
const centerMouse = new THREE.Vector2(0,0);

function lookHit(){
  raycaster.setFromCamera(centerMouse, camera);
  const hits = raycaster.intersectObjects(items, false);
  return hits.length ? hits[0].object : null;
}

function nearCheckout(){
  const dx = camera.position.x - checkoutZone.position.x;
  const dz = camera.position.z - checkoutZone.position.z;
  return (dx*dx + dz*dz) < (4*4);
}

function getNearestNPC(maxDistance = 3){
  let best = null;
  let bestDistSq = maxDistance * maxDistance;

  npcs.forEach(npc => {
    const dx = npc.position.x - camera.position.x;
    const dz = npc.position.z - camera.position.z;
    const distSq = dx*dx + dz*dz;
    if (distSq < bestDistSq){
      bestDistSq = distSq;
      best = npc;
    }
  });

  return best;
}

function nearCashier(maxDistance = 3){
  if (!cashier) return false;
  const dx = camera.position.x - cashier.position.x;
  const dz = camera.position.z - cashier.position.z;
  return (dx*dx + dz*dz) < (maxDistance * maxDistance);
}

function getNearbySoda(maxDistance = 1.8) {
  let nearest = null;
  let bestDistSq = maxDistance * maxDistance;

  items.forEach(obj => {
    if (!obj.userData || obj.userData.name !== "Soda") return;

    const worldPos = new THREE.Vector3();
    obj.getWorldPosition(worldPos);

    const dx = worldPos.x - camera.position.x;
    const dz = worldPos.z - camera.position.z;
    const distSq = dx*dx + dz*dz;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      nearest = obj;
    }
  });

  return nearest;
}

// ========== SHOP LOGIC ==========
function openShop(){
  if (!shopPanel) return;
  shopPanel.classList.add("show");
  shopOpen = true;

  if (document.exitPointerLock) {
    document.exitPointerLock();
  }
  document.body.classList.add("show-cursor");
}

function closeShop(){
  if (!shopPanel) return;
  shopPanel.classList.remove("show");
  shopOpen = false;
}

// ========== SHOP ACTIONS ==========
function buyMolotov(){
  const cost = MOLOTOV_COST;
  if (money < cost){
    toast("Molotov costs $" + cost + ". Not enough money.");
    return;
  }
  money -= cost;
  molotovs += 1;
  updateUI();
  toast("You bought 1 Molotov.");
}

function buyAK(){
  const cost = AK_COST;
  if (hasAK){
    toast("You already have an AK-47.");
    return;
  }
  if (money < cost){
    toast("AK-47 costs $" + cost + ". Not enough money.");
    return;
  }
  money -= cost;
  hasAK = true;
  ammo  = 60;
  updateUI();
  toast("You bought an AK-47 for $" + cost + ".");
}

if (btnBuyMolotov){
  btnBuyMolotov.addEventListener("click", (e)=>{
    e.preventDefault();
    buyMolotov();
  });
}
if (btnBuyAK){
  btnBuyAK.addEventListener("click", (e)=>{
    e.preventDefault();
    buyAK();
  });
}
if (btnCloseShop){
  btnCloseShop.addEventListener("click", (e)=>{
    e.preventDefault();
    closeShop();
  });
}

// ========== FUNNY GORILLA PROPHECY ==========
function createGorilla(position){
  const g = new THREE.Group();

  const darkFur  = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  const midFur   = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.8 });
  const faceMat  = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6 });

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.1, 0.6),
    darkFur
  );
  torso.position.y = 1.1;
  g.add(torso);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.5, 0.5),
    faceMat
  );
  head.position.set(0, 1.75, 0.05);
  g.add(head);

  const snout = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.25, 0.4),
    faceMat
  );
  snout.position.set(0, 1.6, 0.27);
  g.add(snout);

  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const pupilMat    = new THREE.MeshStandardMaterial({ color: 0x000000 });

  const eyeWhiteGeo = new THREE.SphereGeometry(0.05, 12, 12);
  const leftEyeWhite  = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
  const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
  leftEyeWhite.position.set(-0.13, 1.7, 0.34);
  rightEyeWhite.position.set(0.13, 1.7, 0.34);
  g.add(leftEyeWhite, rightEyeWhite);

  const pupilGeo = new THREE.SphereGeometry(0.025, 12, 12);
  const leftPupil  = new THREE.Mesh(pupilGeo, pupilMat);
  const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
  leftPupil.position.set(-0.13, 1.69, 0.36);
  rightPupil.position.set(0.13, 1.69, 0.36);
  g.add(leftPupil, rightPupil);

  const armGeo = new THREE.BoxGeometry(0.28, 0.9, 0.28);
  const leftArm  = new THREE.Mesh(armGeo, midFur);
  const rightArm = new THREE.Mesh(armGeo, midFur);
  leftArm.position.set(-0.6, 1.1, 0);
  rightArm.position.set(0.6, 1.1, 0);
  g.add(leftArm, rightArm);

  const legGeo = new THREE.BoxGeometry(0.32, 0.75, 0.32);
  const leftLeg  = new THREE.Mesh(legGeo, darkFur);
  const rightLeg = new THREE.Mesh(legGeo, darkFur);
  leftLeg.position.set(-0.25, 0.38, 0);
  rightLeg.position.set(0.25, 0.38, 0);
  g.add(leftLeg, rightLeg);

  g.rotation.x = -0.08;

  g.position.copy(position);
  g.lookAt(camera.position.x, g.position.y + 1.2, camera.position.z);

  scene.add(g);
  return g;
}

function createGorillaSpeech(position){
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // bubble background
  ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
  ctx.fillRect(0, 0, 512, 256);

  // border
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8;
  ctx.strokeRect(16, 16, 480, 224);

  // text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 50px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DON'T DRINK THAT!", 256, 110);
  ctx.font = "bold 34px Arial";
  ctx.fillText("THE END IS NEAR", 256, 170);

  const tex = new THREE.CanvasTexture(canvas);

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 1.0
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.7), mat);

  // spawn above gorilla
  plane.position.copy(position).add(new THREE.Vector3(0, 2.3, 0));

  // initial orientation toward camera
  plane.lookAt(
    camera.position.x,
    plane.position.y,
    camera.position.z
  );

  scene.add(plane);
  return plane;
});

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), mat);
  plane.position.copy(position).add(new THREE.Vector3(0, 2.2, 0));
  plane.lookAt(camera.position);

  scene.add(plane);
  return plane;
}

function showGorillaWarning(drinkWorldPos){
  if (gorillaActive) return;

  gorillaActive = true;

  const basePos = drinkWorldPos.clone();
  basePos.y = 0;

  const toCam = new THREE.Vector3().subVectors(camera.position, basePos);
  toCam.y = 0;
  if (toCam.lengthSq() > 0.0001) {
    toCam.normalize().multiplyScalar(1.2);
    basePos.add(toCam);
  }

  gorilla = createGorilla(basePos);
  gorillaSpeech = createGorillaSpeech(basePos);

  if (gorillaTimer) clearTimeout(gorillaTimer);
  gorillaTimer = setTimeout(() => {
    if (gorilla) {
      scene.remove(gorilla);
      gorilla = null;
    }
    if (gorillaSpeech) {
      scene.remove(gorillaSpeech);
      gorillaSpeech = null;
    }
    gorillaActive = false;
  }, 5000);
}

// ========== INTERACT, MUG, JUMP, WEAPONS ==========
function handleInteract(){
  if (shopOpen){
    closeShop();
    return;
  }

  // 1) FIRST: grab Soda near you (triggers gorilla)
  const nearbySoda = getNearbySoda(1.8);
  if (nearbySoda){
    const data = nearbySoda.userData || {};
    const name  = data.name || "Item";
    const price = data.price || 0;
    const paid  = data.paid || false;

    const worldPos = new THREE.Vector3();
    nearbySoda.getWorldPosition(worldPos);
    showGorillaWarning(worldPos);

    if (!paid) {
      if (money < price) {
        toast("Not enough money!");
        return;
      }
      money -= price;
      cartTotal += price;
    }

    if (bought[name] !== undefined) {
      bought[name] += 1;
    }

    scene.remove(nearbySoda);
    const idx = items.indexOf(nearbySoda);
    if (idx !== -1) items.splice(idx, 1);

    toast("+ " + name + (paid ? "" : " ($" + price + ")"));
    updateUI();
    return;
  }

  // 2) SECOND: interact with whatever you're looking at
  const hit = lookHit();
  if (hit){
    const data = hit.userData || {};
    const name  = data.name || "Item";
    const price = data.price || 0;
    const paid  = data.paid || false;

    if (!paid) {
      if (money < price) {
        toast("Not enough money!");
        return;
      }
      money -= price;
      cartTotal += price;
    }

    if (bought[name] !== undefined) {
      bought[name] += 1;
    }

    scene.remove(hit);
    const idx = items.indexOf(hit);
    if (idx !== -1) items.splice(idx, 1);

    toast("+ " + name + (paid ? "" : " ($" + price + ")"));
    updateUI();
    return;
  }

  // 3) LAST: zones
  if (nearCashier()){
    openShop();
    return;
  }

  if (nearCheckout()){
    if (cartTotal === 0) {
      toast("Your cart is empty.");
      return;
    }
    if (Object.keys(list).some(k => bought[k] < list[k])) {
      toast("You still missed items on your list!");
      return;
    }
    toast("🎉 Paid! You win!");
    cartTotal = 0;
    updateUI();
    return;
  }

  if (nearVending()){
    useVendingMachine();
    return;
  }
}

function handleMug(){
  const npc = getNearestNPC(4);
  if (!npc) {
    toast("Nobody close enough to mug.");
    return;
  }

  if (!npc.userData || npc.userData.wallet <= 0){
    toast("They have no money left.");
    return;
  }

  const steal = 1 + Math.floor(Math.random() * 4);
  const amount = Math.min(steal, npc.userData.wallet);

  npc.userData.wallet -= amount;
  money += amount;

  toast("You stole $" + amount + ". They have $" + npc.userData.wallet + " left.");
  updateUI();
}

function handleJump(){
  if (camera.position.y <= GROUND_Y + 0.01 && verticalVelocity === 0) {
    verticalVelocity = JUMP_SPEED;
  }
}

function throwMolotov(){
  if (molotovs <= 0){
    toast("No Molotovs! Buy one from the egg.");
    return;
  }

  molotovs -= 1;
  updateUI();

  const bottle = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xff5500,
      emissive: 0xff2200,
      emissiveIntensity: 0.7
    })
  );

  const startPos = new THREE.Vector3();
  startPos.copy(camera.position);
  startPos.y -= 0.2;
  bottle.position.copy(startPos);

  scene.add(bottle);

  const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation).normalize();
  const speed = 12;
  const velocity = dir.multiplyScalar(speed);
  velocity.y += 3;

  molotovsThrown.push({ mesh: bottle, velocity });
}

function explodeMolotov(position){
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffaa33,
      emissive: 0xff6600,
      emissiveIntensity: 1,
      transparent: true,
      opacity: 0.6
    })
  );
  flash.position.copy(position);
  scene.add(flash);

  let opacity = 0.6;
  const fade = setInterval(() => {
    opacity -= 0.1;
    flash.material.opacity = Math.max(0, opacity);
    if (opacity <= 0){
      clearInterval(fade);
      scene.remove(flash);
    }
  }, 50);
}

function shootAK(){
  if (!hasAK){
    toast("You don't have a gun. Buy one at the egg.");
    return;
  }
  if (ammo <= 0){
    toast("Out of ammo!");
    return;
  }

  ammo -= 1;
  updateUI();

  const dir = new THREE.Vector3(0, 0, -1)
    .applyEuler(camera.rotation)
    .normalize();

  let origin;
  if (gunMuzzle){
    origin = new THREE.Vector3();
    gunMuzzle.getWorldPosition(origin);
  } else {
    origin = camera.position.clone();
  }

  raycaster.set(origin, dir);
  const hits = raycaster.intersectObjects(npcs, true);

  if (hits.length > 0) {
    let obj = hits[0].object;
    let hitNpc = null;
    while (obj && !hitNpc){
      if (npcs.includes(obj)) hitNpc = obj;
      else obj = obj.parent;
    }

    if (hitNpc){
      scene.remove(hitNpc);
      const idx = npcs.indexOf(hitNpc);
      if (idx !== -1) npcs.splice(idx, 1);
      toast("💥 NPC shot!");
    }
  }

  if (gunMuzzle){
    const muzzlePos = new THREE.Vector3();
    gunMuzzle.getWorldPosition(muzzlePos);

    const bulletMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffff55,
        emissive: 0xffee88,
        emissiveIntensity: 0.7
      })
    );
    bulletMesh.position.copy(muzzlePos);
    scene.add(bulletMesh);

    const speed = 40;
    bullets.push({
      mesh: bulletMesh,
      velocity: dir.clone().multiplyScalar(speed),
      life: 1.5
    });
  }
}

// ========== TOUCH CONTROLS ==========
const btnUp       = document.getElementById("btnUp");
const btnDown     = document.getElementById("btnDown");
const btnLeft     = document.getElementById("btnLeft");
const btnRight    = document.getElementById("btnRight");
const btnInteract = document.getElementById("btnInteract");
const btnMug      = document.getElementById("btnMug");
const btnJump     = document.getElementById("btnJump");
const btnThrow    = document.getElementById("btnThrow");
const btnFire     = document.getElementById("btnFire");

function bindHoldButton(btn, keyName){
  if (!btn) return;
  const start = (e) => {
    e.preventDefault();
    keys[keyName] = true;
  };
  const end = (e) => {
    e.preventDefault();
    keys[keyName] = false;
  };

  btn.addEventListener("touchstart", start);
  btn.addEventListener("touchend", end);
  btn.addEventListener("touchcancel", end);
  btn.addEventListener("mousedown", start);
  btn.addEventListener("mouseup", end);
  btn.addEventListener("mouseleave", end);
}

bindHoldButton(btnUp,    "w");
bindHoldButton(btnDown,  "s");
bindHoldButton(btnLeft,  "a");
bindHoldButton(btnRight, "d");

if (btnInteract){
  const h = (e) => {
    e.preventDefault();
    handleInteract();
  };
  btnInteract.addEventListener("click", h);
  btnInteract.addEventListener("touchstart", h);
}

if (btnMug){
  const h2 = (e) => {
    e.preventDefault();
    handleMug();
  };
  btnMug.addEventListener("click", h2);
  btnMug.addEventListener("touchstart", h2);
}

if (btnJump){
  const h3 = (e) => {
    e.preventDefault();
    handleJump();
  };
  btnJump.addEventListener("click", h3);
  btnJump.addEventListener("touchstart", h3);
}

if (btnThrow){
  const h4 = (e) => {
    e.preventDefault();
    throwMolotov();
  };
  btnThrow.addEventListener("click", h4);
  btnThrow.addEventListener("touchstart", h4);
}

if (btnFire){
  const h5 = (e) => {
    e.preventDefault();
    shootAK();
  };
  btnFire.addEventListener("click", h5);
  btnFire.addEventListener("touchstart", h5);
}

// ========== MOVEMENT & LOOP ==========
function move(dt){
  const speed = (keys["shift"] ? 6.5 : 4.2);
  const forward = new THREE.Vector3(0,0,-1).applyEuler(camera.rotation);
  forward.y = 0; forward.normalize();
  const right = new THREE.Vector3(1,0,0).applyEuler(camera.rotation);
  right.y = 0; right.normalize();

  const v = new THREE.Vector3();
  if (keys["w"]) v.add(forward);
  if (keys["s"]) v.sub(forward);
  if (keys["d"]) v.add(right);
  if (keys["a"]) v.sub(right);
  if (v.lengthSq() > 0) {
    v.normalize().multiplyScalar(speed * dt);
    camera.position.add(v);
  }

  camera.position.x = Math.max(-18.5, Math.min(18.5, camera.position.x));
  camera.position.z = Math.max(-18.5, Math.min(18.5, camera.position.z));
}

let last = performance.now();

function animate(){
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  move(dt);

  verticalVelocity += GRAVITY * dt;
  camera.position.y += verticalVelocity * dt;

  if (camera.position.y <= GROUND_Y){
    camera.position.y = GROUND_Y;
    verticalVelocity = 0;
  }

  camera.rotation.set(pitch, yaw, 0, "YXZ");

  npcs.forEach(npc => {
    npc.position.z += npc.userData.dir * npc.userData.speed * dt;

    const maxZ = 10;
    if (npc.position.z > maxZ) {
      npc.position.z = maxZ;
      npc.userData.dir *= -1;
      npc.rotation.y += Math.PI;
    }
    if (npc.position.z < -maxZ) {
      npc.position.z = -maxZ;
      npc.userData.dir *= -1;
      npc.rotation.y += Math.PI;
    }
  });

  for (let i = molotovsThrown.length - 1; i >= 0; i--){
    const proj = molotovsThrown[i];
    proj.velocity.y += GRAVITY * dt * 0.5;
    proj.mesh.position.addScaledVector(proj.velocity, dt);

    let exploded = false;

    if (proj.mesh.position.y <= 0.1){
      explodeMolotov(proj.mesh.position);
      scene.remove(proj.mesh);
      molotovsThrown.splice(i, 1);
      exploded = true;
    }

    if (exploded) continue;

    for (let j = npcs.length - 1; j >= 0; j--){
      const npc = npcs[j];
      const dx = npc.position.x - proj.mesh.position.x;
      const dz = npc.position.z - proj.mesh.position.z;
      const dy = (npc.position.y + 1.0) - proj.mesh.position.y;
      const distSq = dx*dx + dy*dy + dz*dz;

      if (distSq < 1.0){
        explodeMolotov(proj.mesh.position);
        scene.remove(proj.mesh);
        molotovsThrown.splice(i, 1);

        scene.remove(npc);
        npcs.splice(j, 1);

        toast("🔥 NPC down!");
        exploded = true;
        break;
      }
    }
  }

  for (let i = bullets.length - 1; i >= 0; i--){
    const b = bullets[i];
    b.mesh.position.addScaledVector(b.velocity, dt);
    b.life -= dt;

    const distSq = b.mesh.position.distanceToSquared(camera.position);

    if (b.life <= 0 || distSq > 2000){
      scene.remove(b.mesh);
      bullets.splice(i, 1);
    }
  }

  for (let i = 0; i < clouds.length; i++){
    const c = clouds[i];
    const data = c.userData;
    c.position.x += data.dir * data.speed * dt;

    if (c.position.x > 25){
      c.position.x = -25;
    } else if (c.position.x < -25){
      c.position.x = 25;
    }
  }

  pigSpawnTimer -= dt;
  if (pigSpawnTimer <= 0){
    const fromLeft = Math.random() > 0.5;
    createFlyingPig(fromLeft);
    pigSpawnTimer = 6 + Math.random() * 10;
  }

  for (let i = pigs.length - 1; i >= 0; i--){
    const pig = pigs[i];
    const data = pig.userData;

    pig.position.x += data.dir * data.speed * dt;
    data.phase += dt * 2.0;
    pig.position.y = data.baseY + Math.sin(data.phase) * 0.3;

    if (Math.abs(pig.position.x) > 32){
      scene.remove(pig);
      pigs.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
