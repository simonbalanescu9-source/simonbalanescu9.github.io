// ---------- Basics ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 1.6, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(6, 10, 4);
scene.add(dir);

// UI
const moneyText = document.getElementById("money");
const cartText  = document.getElementById("cart");
const listText  = document.getElementById("list");
const toastEl   = document.getElementById("toast");
// ---------- Simple Background Music ----------
const musicBtn = document.getElementById("musicBtn");
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
  osc.frequency.value = 220; // calm tone
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

musicBtn.addEventListener("click", () => {
  musicOn ? stopMusic() : startMusic();
});
function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(()=> toastEl.classList.remove("show"), 1200);
}

// ---------- Store room ----------
// ---------- Tiled Floor ----------
const floorSize = 40; // width & depth in world units

// Create a canvas texture with tile lines
const tileCanvas = document.createElement("canvas");
tileCanvas.width = 1024;
tileCanvas.height = 1024;
const tctx = tileCanvas.getContext("2d");

// Base color
tctx.fillStyle = "#f4f4f4";
tctx.fillRect(0, 0, tileCanvas.width, tileCanvas.height);

// Draw grid lines (tiles)
tctx.strokeStyle = "#d0d0d0";
tctx.lineWidth = 2;

const tiles = 16; // 16 x 16 tiles
const step = tileCanvas.width / tiles;

for (let i = 0; i <= tiles; i++) {
  // vertical
  tctx.beginPath();
  tctx.moveTo(i * step, 0);
  tctx.lineTo(i * step, tileCanvas.height);
  tctx.stroke();

  // horizontal
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


// Simple walls
function wall(w,h,d,x,y,z){
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w,h,d),
    new THREE.MeshStandardMaterial({ color: 0xfafafa })
  );
  m.position.set(x,y,z);
  scene.add(m);
}
wall(40,4,0.5, 0,2, -20);
wall(40,4,0.5, 0,2,  20);
wall(0.5,4,40, -20,2, 0);
wall(0.5,4,40,  20,2, 0);
// ---------- Christmas Trees (GUARANTEED VISIBLE) ----------
function createChristmasTree(x, z) {
  const tree = new THREE.Group();

  // trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.25, 0.8, 12),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b })
  );
  trunk.position.y = 0.4;
  tree.add(trunk);

  // leaves
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

  // star
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

// PUT ONE TREE RIGHT IN FRONT OF PLAYER (TEST)
createChristmasTree(0, 2);

// STORE CORNERS (INSIDE WALLS)
createChristmasTree(-15, -15);
createChristmasTree(-15,  15);
createChristmasTree( 15, -15);
createChristmasTree( 15,  15);
// ---------- Posters (Metal Pipes Ads) ----------
function createPoster(text, x, y, z, rotY = 0, bg = "#ffd700", fg = "#000000") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = "#000";
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, 496, 496);

  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "900 84px Arial";
  ctx.fillText("METAL", 256, 210);
  ctx.fillText("PIPES", 256, 310);

  ctx.font = "bold 28px Arial";
  ctx.fillText("STRONG • LOUD • RELIABLE", 256, 395);

  const texture = new THREE.CanvasTexture(canvas);

  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,       // IMPORTANT
      emissive: new THREE.Color(0x222222), // makes it pop a bit
      emissiveIntensity: 0.6
    })
  );

  poster.position.set(x, y, z);
  poster.rotation.y = rotY;
  scene.add(poster);
}

// Place posters
createPoster("METAL PIPES",  0, 2.2, -19.7, 0);
createPoster("METAL PIPES", -19.7, 2.2,  0, Math.PI / 2);
createPoster("METAL PIPES", 19.7, 2.2,   4, -Math.PI / 2);
createPoster("METAL PIPES", 10, 2.2, 19.7, Math.PI);
// Checkout counter
const counter = new THREE.Mesh(
  new THREE.BoxGeometry(6, 1.1, 2),
  new THREE.MeshStandardMaterial({ color: 0xdadada })
);
counter.position.set(-14, 0.55, 14);
scene.add(counter);

// Checkout zone
const checkoutZone = new THREE.Mesh(
  new THREE.BoxGeometry(5, 0.1, 5),
  new THREE.MeshStandardMaterial({ color: 0x88ff88, transparent: true, opacity: 0.22 })
);
checkoutZone.position.set(-14, 0.05, 10);
scene.add(checkoutZone);

// ---------- Cashier (Egg with Eyes) ----------
function createCashier(x, z) {
  const cashier = new THREE.Group();

  // Egg body
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0xfff3d1 })
  );
  // stretch into egg shape
  body.scale.y = 1.4;
  cashier.add(body);

  // Face "front" rotation
  cashier.rotation.y = Math.PI; // facing player coming to counter

  // Eyes
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const eyeBlackMat = new THREE.MeshStandardMaterial({ color: 0x000000 });

  const leftEyeWhite = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 16, 16),
    eyeWhiteMat
  );
  const rightEyeWhite = leftEyeWhite.clone();

  leftEyeWhite.position.set(-0.16, 0.25, 0.45);
  rightEyeWhite.position.set(0.16, 0.25, 0.45);

  cashier.add(leftEyeWhite);
  cashier.add(rightEyeWhite);

  const leftPupil = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 12, 12),
    eyeBlackMat
  );
  const rightPupil = leftPupil.clone();

  leftPupil.position.set(-0.16, 0.24, 0.50);
  rightPupil.position.set(0.16, 0.24, 0.50);

  cashier.add(leftPupil);
  cashier.add(rightPupil);

  // Tiny mouth (optional)
  const mouth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  mouth.rotation.x = Math.PI / 2;
  mouth.position.set(0, 0.12, 0.50);
  cashier.add(mouth);

  // Position near counter
  cashier.position.set(x, 0.55, z);

  scene.add(cashier);
  return cashier;
}

// Place cashier standing behind the counter
const cashier = createCashier(-14, 13);

// ---------- Shelves (aisles) ----------
function shelf(x, z, length=12){
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.6, length),
    new THREE.MeshStandardMaterial({ color: 0xc9b48a })
  );
  base.position.set(x, 0.8, z);
  scene.add(base);

  // little “rack” feel: slats
  for(let i=0;i<4;i++){
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.08, length),
      new THREE.MeshStandardMaterial({ color: 0xb99f6e })
    );
    slat.position.set(x, 0.25 + i*0.45, z);
    scene.add(slat);
  }
}
shelf(-6, -6, 14);
shelf( 0, -6, 14);
shelf( 6, -6, 14);
shelf(-6,  6, 14);
shelf( 0,  6, 14);
shelf( 6,  6, 14);

// ---------- Game data ----------
let money = 20;
let cartTotal = 0;

// shopping list
const list = { Apple: 2, Milk: 1, Cereal: 1 };
const bought = { Apple: 0, Milk: 0, Cereal: 0 };

function updateUI(){
  moneyText.textContent = `Money: $${money}`;
  cartText.textContent  = `Cart: $${cartTotal}`;

  const parts = Object.keys(list).map(k => `${k} x${Math.max(0, list[k]-bought[k])}`);
  listText.textContent = `List: ${parts.join(", ")}`;

  if (Object.keys(list).every(k => bought[k] >= list[k])) {
    toast("✅ You bought everything! Go pay at checkout!");
  }
}
updateUI();

// ---------- Items ----------
const items = [];
const itemMat = (color) => new THREE.MeshStandardMaterial({ color });

function createItem(name, price, x, y, z, color){
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), itemMat(color));
  mesh.position.set(x, y, z);
  mesh.userData = { type:"item", name, price };
  scene.add(mesh);
  items.push(mesh);
  return mesh;
}

// Place items on shelves (y heights)
createItem("Apple",  3, -6, 1.15, -10, 0xff4d4d);
createItem("Apple",  3,  0, 1.15, -10, 0xff4d4d);
createItem("Milk",   5,  6, 1.15,  -2, 0xffffff);
createItem("Cereal", 7, -6, 0.70,   2, 0xffcc33);

// Extra filler items (looks nicer)
createItem("Juice",  4,  0, 0.70,   2, 0xff8844);
createItem("Bread",  2,  6, 0.70, -10, 0xd2a679);

// ---------- Controls: pointer lock + WASD + mouse look ----------
let yaw = 0, pitch = 0;
const keys = {};
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup",   e => keys[e.key.toLowerCase()] = false);
// ---------- Touch Controls for Mobile ----------
const btnUp       = document.getElementById("btnUp");
const btnDown     = document.getElementById("btnDown");
const btnLeft     = document.getElementById("btnLeft");
const btnRight    = document.getElementById("btnRight");
const btnInteract = document.getElementById("btnInteract");

function bindHoldButton(btn, keyName){
  if (!btn) return;
  const start = (e) => { e.preventDefault(); keys[keyName] = true; };
  const end   = (e) => { e.preventDefault(); keys[keyName] = false; };

  btn.addEventListener("touchstart", start);
  btn.addEventListener("touchend", end);
  btn.addEventListener("mousedown", start);
  btn.addEventListener("mouseup", end);
  btn.addEventListener("mouseleave", end);
}

bindHoldButton(btnUp,    "w");
bindHoldButton(btnDown,  "s");
bindHoldButton(btnLeft,  "a");
bindHoldButton(btnRight, "d");

if (btnInteract){
  btnInteract.addEventListener("click", (e) => {
    e.preventDefault();
    handleInteract();
  });
  btnInteract.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handleInteract();
  });
}
document.addEventListener("click", () => {
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
// ---------- Touch / Drag Look ----------
let touchLookActive = false;
let lastTouchX = 0;
let lastTouchY = 0;

const lookSensitivity = 0.0022;

// Touch start: begin looking
renderer.domElement.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) return; // one finger to look
  touchLookActive = true;
  lastTouchX = e.touches[0].clientX;
  lastTouchY = e.touches[0].clientY;
});

// Touch move: rotate camera
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

// Touch end: stop looking
renderer.domElement.addEventListener("touchend", () => {
  touchLookActive = false;
});

// Optional: drag with mouse if pointer lock isn't active
let mouseDragLook = false;
renderer.domElement.addEventListener("mousedown", (e) => {
  if (document.pointerLockElement !== renderer.domElement) {
    mouseDragLook = true;
    lastTouchX = e.clientX;
    lastTouchY = e.clientY;
  }
});

renderer.domElement.addEventListener("mouseup", () => {
  mouseDragLook = false;
});

renderer.domElement.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === renderer.domElement) return; // handled above
  if (!mouseDragLook) return;

  const dx = e.clientX - lastTouchX;
  const dy = e.clientY - lastTouchY;
  lastTouchX = e.clientX;
  lastTouchY = e.clientY;

  yaw   -= dx * lookSensitivity;
  pitch -= dy * lookSensitivity;
  pitch = Math.max(-1.2, Math.min(1.2, pitch));
  camera.rotation.set(pitch, yaw, 0, "YXZ");
});
// Movement (no physics, but decent)
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
  v.normalize().multiplyScalar(speed * dt);

  camera.position.add(v);

  // keep player inside store bounds
  camera.position.x = Math.max(-18.5, Math.min(18.5, camera.position.x));
  camera.position.z = Math.max(-18.5, Math.min(18.5, camera.position.z));
}

// ---------- Interaction (E) ----------
const raycaster = new THREE.Raycaster();
function lookHit(){
  raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
  const hits = raycaster.intersectObjects(items, false);
  return hits.length ? hits[0].object : null;
}

function nearCheckout(){
  const dx = camera.position.x - checkoutZone.position.x;
  const dz = camera.position.z - checkoutZone.position.z;
  return (Math.abs(dx) < 2.5 && Math.abs(dz) < 2.5);
}

function handleInteract(){
  // checkout
  if (nearCheckout()){
    if (cartTotal === 0) return toast("Your cart is empty.");
    if (Object.keys(list).some(k => bought[k] < list[k])) return toast("You still missed items on your list!");
    toast("🎉 Paid! You win!");
    cartTotal = 0;
    updateUI();
    return;
  }

function getNearestNPC(maxDistance = 3) {
  let best = null;
  let bestDistSq = maxDistance * maxDistance;

  npcs.forEach(npc => {
    const dx = npc.position.x - camera.position.x;
    const dz = npc.position.z - camera.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = npc;
    }
  });

  return best;
}

  // pick item
  const hit = lookHit();
  if (!hit) return;

  const { name, price } = hit.userData;
  if (money < price) return toast("Not enough money!");

  money -= price;
  cartTotal += price;
  if (bought[name] !== undefined) bought[name] += 1;

  scene.remove(hit);
  items.splice(items.indexOf(hit), 1);

  toast(`+ ${name} ($${price})`);
  updateUI();
}

document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() !== "e") return;
  handleInteract();
});

function handleMug(){
  const npc = getNearestNPC();
  if (!npc) {
    toast("Nobody close enough to mug.");
    return;
  }

  if (!npc.userData || npc.userData.wallet <= 0) {
    toast("They have no money left.");
    return;
  }

  const steal = 1 + Math.floor(Math.random() * 4); // 1–4
  const amount = Math.min(steal, npc.userData.wallet);

  npc.userData.wallet -= amount;
  money += amount;
  toast(`You stole $${amount}. (They have $${npc.userData.wallet} left)`);
  updateUI();
}

// ---------- NPCs ----------
const npcs = [];

function createNPC(x, z, color = 0x88aaff) {
  const npc = new THREE.Group();

  // Body
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.25, 0.7, 4, 8),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 0.7;
  npc.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffe0bd })
  );
  head.position.y = 1.3;
  npc.add(head);

  npc.position.set(x, 0, z);

  // Movement data
    npc.userData = {
    dir: Math.random() > 0.5 ? 1 : -1,
    speed: 0.8 + Math.random() * 0.6,
    wallet: 4 + Math.floor(Math.random() * 6) // 4–9 dollars
  };


  scene.add(npc);
  npcs.push(npc);
  return npc;
}

// Spawn NPCs
createNPC(-10, -4);
createNPC(4, -8, 0xaaffaa);
createNPC(10, 5, 0xffaaaa);
// ---------- Animation loop ----------
let last = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  move(dt);
  // NPC movement
npcs.forEach(npc => {
  npc.position.z += npc.userData.dir * npc.userData.speed * dt;

  if (npc.position.z > 14 || npc.position.z < -14) {
    npc.userData.dir *= -1;
    npc.rotation.y += Math.PI;
  }
});
  renderer.render(scene, camera);
}
animate();

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
