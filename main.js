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

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
document.body.appendChild(renderer.domElement);

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

function toast(msg){
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
  musicBtn.textContent = "🔇 Music: On";
}

function stopMusic(){
  if (!musicOn) return;
  osc.stop();
  osc.disconnect();
  gain.disconnect();
  musicOn = false;
  musicBtn.textContent = "🔊 Music: Off";
}

musicBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (!audioCtx) {
    startMusic();
  } else {
    musicOn ? stopMusic() : startMusic();
  }
});

// ========== INPUT (KEYBOARD) ==========
const keys = {};

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  // track movement / turn keys
  keys[key] = true;

  if (key === "e") {
    handleInteract();
  } else if (key === "f") {
    handleMug();
  } else if (e.code === "Space") {
    handleJump();
  } else if (key === "r") {
    // R to throw Molotov
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
const GROUND_Y = 1.6;    // standing eye height
const GRAVITY  = -20;    // units per second^2
const JUMP_SPEED = 7;    // how strong the jump is

document.addEventListener("click", () => {
  // avoid pointer lock on mobile
  if (/Mobi|Android/i.test(navigator.userAgent)) return;
  if (document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
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

// Touch drag look (for phones / tablets)
let touchLookActive = false;
let lastTouchX = 0;
let lastTouchY = 0;
const lookSensitivity = 0.0022;

renderer.domElement.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) return; // one finger to look
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

  yaw   -= dx * lookSensitivity;   // left / right
  pitch -= dy * lookSensitivity;   // up / down
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

// ========== TILED FLOOR ==========
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

// red background
sctx.fillStyle = "#c41420";
sctx.fillRect(0, 0, santaCanvas.width, santaCanvas.height);

// diagonal white stripes
sctx.strokeStyle = "#ffffff";
sctx.lineWidth = 16;
for (let i = -512; i < 512; i += 80) {
  sctx.beginPath();
  sctx.moveTo(i, 0);
  sctx.lineTo(i + 512, 512);
  sctx.stroke();
}

// simple repeating Santa faces
function drawSanta(x, y) {
  // face
  sctx.fillStyle = "#ffe0c4";
  sctx.beginPath();
  sctx.arc(x, y, 36, 0, Math.PI * 2);
  sctx.fill();

  // hat
  sctx.fillStyle = "#b00012";
  sctx.beginPath();
  sctx.moveTo(x - 40, y - 10);
  sctx.lineTo(x + 40, y - 10);
  sctx.lineTo(x, y - 70);
  sctx.closePath();
  sctx.fill();

  // hat brim
  sctx.fillStyle = "#ffffff";
  sctx.fillRect(x - 42, y - 16, 84, 12);

  // beard
  sctx.beginPath();
  sctx.moveTo(x - 40, y + 10);
  sctx.quadraticCurveTo(x, y + 55, x + 40, y + 10);
  sctx.quadraticCurveTo(x, y + 75, x - 40, y + 10);
  sctx.fill();

  // eyes
  sctx.fillStyle = "#000000";
  sctx.beginPath();
  sctx.arc(x - 12, y - 5, 4, 0, Math.PI * 2);
  sctx.arc(x + 12, y - 5, 4, 0, Math.PI * 2);
  sctx.fill();

  // nose
  sctx.fillStyle = "#ffb199";
  sctx.beginPath();
  sctx.arc(x, y + 5, 5, 0, Math.PI * 2);
  sctx.fill();
}

// draw Santas in a grid
const cols = 3;
const rows = 3;
for (let i = 0; i < cols; i++) {
  for (let j = 0; j < rows; j++) {
    const x = (i + 0.5) * (santaCanvas.width / cols);
    const y = (j + 0.5) * (santaCanvas.height / rows);
    drawSanta(x, y);
  }
}

const santaTex = new THREE.CanvasTexture(santaCanvas);
santaTex.wrapS = THREE.RepeatWrapping;
santaTex.wrapT = THREE.RepeatWrapping;
santaTex.repeat.set(2, 1); // tile horizontally

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

// ========== CHRISTMAS TREES ==========
function createChristmasTree(x, z) {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.25, 0.8, 12),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b })
  );
  trunk.position.y = 0.4;
  tree.add(trunk);

  const leavesMat = new THREE.MeshStandardMaterial({ color: 0x0f7a3a });
  const l1 = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.2, 16), leavesMat);
  l1.position.y = 1.2;
  tree.add(l1);
  const l2 = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.1, 16), leavesMat);
  l2.position.y = 1.8;
  tree.add(l2);
  const l3 = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.0, 16), leavesMat);
  l3.position.y = 2.4;
  tree.add(l3);

  const star = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22),
    new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 1
    })
  );
  star.position.y = 3.1;
  tree.add(star);

  tree.position.set(x, 0.05, z);
  scene.add(tree);
}
createChristmasTree(-17, -17);
createChristmasTree(-17,  17);
createChristmasTree( 17, -17);
createChristmasTree( 17,  17);

// ========== METAL PIPES POSTERS ==========
function createPoster(x, y, z, rotY = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffd700";
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = "#000";
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, 496, 496);

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

createPoster( 0,   2.2, -18.8,  0);
createPoster(-18.8,2.2,   0,    Math.PI/2);
createPoster( 18.8,2.2,   4,   -Math.PI/2);
createPoster( 10,  2.2, 18.8,  Math.PI);

// FISHING POSTER
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

createFishingPoster(-10, 2.2, 18.8, Math.PI);

// ========== GAME DATA ==========
let money = 20;
let cartTotal = 0;
let molotovs = 0;

const list = { Apple: 2, Milk: 1, Cereal: 1 };
const bought = { Apple: 0, Milk: 0, Cereal: 0 };

function updateUI(){
  moneyText.textContent = `Money: $${money}`;
  cartText.textContent  = `Cart: $${cartTotal}`;
  if (molotovText) {
    molotovText.textContent = `Molotovs: ${molotovs}`;
  }
  const parts = Object.keys(list).map(k => `${k} x${Math.max(0, list[k]-bought[k])}`);
  listText.textContent = `List: ${parts.join(", ")}`;
}
updateUI();

// ========== ITEMS ==========
const items = [];
const itemMat = (color) => new THREE.MeshStandardMaterial({ color });

function createItem(name, price, x, y, z, color){
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5), itemMat(color));
  mesh.position.set(x, y, z);
  mesh.userData = { type:"item", name, price };
  scene.add(mesh);
  items.push(mesh);
}

createItem("Apple",  3, -6, 1.15, -10, 0xff4d4d);
createItem("Apple",  3,  0, 1.15, -10, 0xff4d4d);
createItem("Milk",   5,  6, 1.15,  -2, 0xffffff);
createItem("Cereal", 7, -6, 0.70,   2, 0xffcc33);
createItem("Juice",  4,  0, 0.70,   2, 0xff8844);
createItem("Bread",  2,  6, 0.70, -10, 0xd2a679);

// ========== NPC SHOPPERS & MOLOTOV STORAGE ==========
const npcs = [];
const molotovsThrown = [];

function createNPC(x, z, color = 0x88aaff) {
  const npc = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.25, 0.7, 4, 8),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 0.7;
  npc.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffe0bd })
  );
  head.position.y = 1.3;
  npc.add(head);

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

// ========== INTERACT & MUG ==========
function handleInteract(){
  // 1) Buy Molotov from cashier if close
  if (nearCashier()){
    const cost = 15;
    if (money < cost){
      toast("Molotov costs $15. Not enough money.");
      return;
    }
    money -= cost;
    molotovs += 1;
    updateUI();
    toast("You bought 1 Molotov.");
    return;
  }

  // 2) Checkout if near the green zone
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

  // 3) Try to buy an item from shelves
  const hit = lookHit();
  if (!hit) return;

  const { name, price } = hit.userData;
  if (money < price) {
    toast("Not enough money!");
    return;
  }

  money -= price;
  cartTotal += price;
  if (bought[name] !== undefined) bought[name] += 1;

  scene.remove(hit);
  items.splice(items.indexOf(hit), 1);

  toast(`+ ${name} ($${price})`);
  updateUI();
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

  toast(`You stole $${amount}. They have $${npc.userData.wallet} left.`);
  updateUI();
}

function handleJump(){
  if (camera.position.y <= GROUND_Y + 0.01 && verticalVelocity === 0) {
    verticalVelocity = JUMP_SPEED;
  }
}

function throwMolotov(){
  if (molotovs <= 0){
    toast("No Molotovs! Buy one from the cashier.");
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

// ========== TOUCH CONTROLS ==========
const btnUp       = document.getElementById("btnUp");
const btnDown     = document.getElementById("btnDown");
const btnLeft     = document.getElementById("btnLeft");
const btnRight    = document.getElementById("btnRight");
const btnInteract = document.getElementById("btnInteract");
const btnMug      = document.getElementById("btnMug");
const btnJump     = document.getElementById("btnJump");

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

// movement
bindHoldButton(btnUp,    "w");
bindHoldButton(btnDown,  "s");
bindHoldButton(btnLeft,  "a");
bindHoldButton(btnRight, "d");

// tap actions
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

  // Player movement
  move(dt);

  // JUMP / GRAVITY for player
  verticalVelocity += GRAVITY * dt;
  camera.position.y += verticalVelocity * dt;

  if (camera.position.y <= GROUND_Y){
    camera.position.y = GROUND_Y;
    verticalVelocity = 0;
  }

  // Turn with Q/E (desktop or touch buttons)
  const turnSpeed = 1.6;
  if (keys["q"]) {
    yaw += turnSpeed * dt;
  }
  if (keys["e"]) {
    yaw -= turnSpeed * dt;
  }
  camera.rotation.set(pitch, yaw, 0, "YXZ");

  // NPC movement
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

  // Molotovs movement + collision
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

  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
