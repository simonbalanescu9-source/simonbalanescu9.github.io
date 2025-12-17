// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);

// Camera
const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.set(0, 1.6, 5);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Light
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));

// Floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0xeeeeee })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Player movement
const keys = {};
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// Game data
let money = 20;
let cart = 0;

// UI
const moneyText = document.getElementById("money");
const cartText = document.getElementById("cart");

// Grocery items
const items = [];

function createItem(name, price, x, z, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ color })
  );
  mesh.position.set(x, 0.3, z);
  mesh.userData = { name, price };
  scene.add(mesh);
  items.push(mesh);
}

createItem("Apple", 3, -2, -2, 0xff4444);
createItem("Milk", 5, 0, -2, 0xffffff);
createItem("Cereal", 7, 2, -2, 0xffcc00);

// Raycaster for clicking items
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener("click", event => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(items);

  if (hits.length > 0) {
    const item = hits[0].object;
    const price = item.userData.price;

    if (money >= price) {
      money -= price;
      cart += price;
      scene.remove(item);
      items.splice(items.indexOf(item), 1);
      updateUI();
    } else {
      alert("Not enough money!");
    }
  }
});

function updateUI() {
  moneyText.textContent = `Money: $${money}`;
  cartText.textContent = `Cart: $${cart}`;
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Movement
  const speed = 0.07;
  if (keys["w"]) camera.position.z -= speed;
  if (keys["s"]) camera.position.z += speed;
  if (keys["a"]) camera.position.x -= speed;
  if (keys["d"]) camera.position.x += speed;

  renderer.render(scene, camera);
}

animate();

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
