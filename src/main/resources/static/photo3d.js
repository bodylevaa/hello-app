/* 3D фото-вьюер на Three.js: карточка с фото, которую можно вращать мышью/пальцем. */

let scene, camera, renderer, controls, mesh, texture;
let originalImage = null;
const workCanvas = document.createElement("canvas");

const canvasEl = document.getElementById("three-canvas");
const viewerHint = document.getElementById("viewer-hint");
const photoInput = document.getElementById("photo-input");
const photoStatus = document.getElementById("photo-status");
const galleryEl = document.getElementById("photo-gallery");
const autorotateToggle = document.getElementById("autorotate-toggle");

function initThree() {
  if (!canvasEl) return;

  const width = canvasEl.clientWidth || 320;
  const height = canvasEl.clientHeight || 320;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 4);

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(2, 3, 4);
  scene.add(dirLight);
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.3);
  rimLight.position.set(-3, -1, -2);
  scene.add(rimLight);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 1.8;
  controls.maxDistance = 8;
  controls.autoRotate = autorotateToggle ? autorotateToggle.checked : true;
  controls.autoRotateSpeed = 2.2;

  window.addEventListener("resize", onResize);
  animate();
}

function onResize() {
  if (!renderer || !canvasEl) return;
  const width = canvasEl.clientWidth;
  const height = canvasEl.clientHeight;
  if (width === 0 || height === 0) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

function ensureMeshForImage(img) {
  const aspect = img.width / img.height;
  const cardHeight = 2.4;
  const cardWidth = cardHeight * aspect;
  const depth = 0.06;

  workCanvas.width = img.width;
  workCanvas.height = img.height;
  const ctx = workCanvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  if (texture) texture.dispose();
  texture = new THREE.CanvasTexture(workCanvas);

  const frontMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, metalness: 0.05 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });

  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
  }

  const geometry = new THREE.BoxGeometry(cardWidth, cardHeight, depth);
  // BoxGeometry material group order: [+x, -x, +y, -y, +z, -z]; camera looks from +z.
  const materials = [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, edgeMat];
  mesh = new THREE.Mesh(geometry, materials);
  scene.add(mesh);
}

function getSelectedFilter() {
  const active = document.querySelector(".filter-btn.active");
  return active ? active.dataset.filter : "none";
}

function applyFilter(filter) {
  if (!originalImage) return;
  const ctx = workCanvas.getContext("2d");
  ctx.drawImage(originalImage, 0, 0, workCanvas.width, workCanvas.height);

  if (filter !== "none") {
    const imgData = ctx.getImageData(0, 0, workCanvas.width, workCanvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (filter === "grayscale") {
        const v = 0.299 * r + 0.587 * g + 0.114 * b;
        d[i] = d[i + 1] = d[i + 2] = v;
      } else if (filter === "sepia") {
        d[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        d[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        d[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
      } else if (filter === "invert") {
        d[i] = 255 - r;
        d[i + 1] = 255 - g;
        d[i + 2] = 255 - b;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  if (texture) texture.needsUpdate = true;
}

function loadImageIntoViewer(src) {
  const img = new Image();
  img.onload = () => {
    originalImage = img;
    ensureMeshForImage(img);
    applyFilter(getSelectedFilter());
    if (viewerHint) viewerHint.style.display = "none";
  };
  img.onerror = () => {
    if (photoStatus) photoStatus.textContent = "Не удалось загрузить изображение для просмотра.";
  };
  img.src = src;
}

async function loadGallery() {
  if (!galleryEl) return;
  try {
    const res = await fetch("/api/photos");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const items = await res.json();
    galleryEl.innerHTML = "";
    items.forEach((item) => {
      const thumb = document.createElement("img");
      thumb.src = item.url;
      thumb.className = "gallery-thumb";
      thumb.alt = "Фото из галереи";
      thumb.title = "Открыть в 3D";
      thumb.addEventListener("click", () => loadImageIntoViewer(item.url));
      galleryEl.appendChild(thumb);
    });
  } catch (err) {
    // Галерея необязательна — молча игнорируем ошибку загрузки списка.
  }
}

if (photoInput) {
  photoInput.addEventListener("change", async () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => loadImageIntoViewer(e.target.result);
    reader.readAsDataURL(file);

    if (photoStatus) photoStatus.textContent = "Загрузка на сервер...";
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/photos", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "HTTP " + res.status);
      }
      if (photoStatus) photoStatus.textContent = "Сохранено в общей галерее!";
      await loadGallery();
    } catch (err) {
      if (photoStatus) {
        photoStatus.textContent = "Не удалось сохранить на сервере: " + err.message + " (но локально фото всё равно можно покрутить)";
      }
    }
  });
}

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    applyFilter(btn.dataset.filter);
  });
});

if (autorotateToggle) {
  autorotateToggle.addEventListener("change", (e) => {
    if (controls) controls.autoRotate = e.target.checked;
  });
}

if (canvasEl) {
  initThree();
  loadGallery();
}
