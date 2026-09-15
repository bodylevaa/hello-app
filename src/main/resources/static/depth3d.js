/*
 * Экспериментальная оценка глубины по одному фото прямо в браузере (transformers.js,
 * модель depth-anything-small). Работает независимо от photo3d.js и обращается
 * к нему через window.PhotoViewer3D. Если что-то пойдёт не так (нет WebGPU/WASM,
 * сеть, неожиданный формат ответа модели) — просто показываем ошибку и оставляем
 * обычную плоскую 3D-карточку рабочей.
 */
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3";

const MODEL_CANDIDATES = ["Xenova/depth-anything-small-hf", "Xenova/dpt-hybrid-midas"];

let estimatorPromise = null;

function getEstimator(onProgress) {
  if (estimatorPromise) return estimatorPromise;

  estimatorPromise = (async () => {
    let lastError = null;
    for (const modelId of MODEL_CANDIDATES) {
      try {
        return await pipeline("depth-estimation", modelId, { progress_callback: onProgress });
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("Не удалось загрузить ни одну модель оценки глубины");
  })();

  return estimatorPromise;
}

function rawDepthToCanvas(raw) {
  if (raw && typeof raw.toCanvas === "function") {
    return raw.toCanvas();
  }
  const canvas = document.createElement("canvas");
  canvas.width = raw.width;
  canvas.height = raw.height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(raw.width, raw.height);
  const total = raw.width * raw.height;
  const channels = raw.channels || Math.max(1, Math.round(raw.data.length / total));
  for (let i = 0, p = 0; p < imageData.data.length; i += channels, p += 4) {
    const v = raw.data[i];
    imageData.data[p] = v;
    imageData.data[p + 1] = v;
    imageData.data[p + 2] = v;
    imageData.data[p + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

const rebuildBtn = document.getElementById("rebuild-3d-btn");
const depthStatus = document.getElementById("depth-status");

function setStatus(text) {
  if (depthStatus) depthStatus.textContent = text;
}

if (rebuildBtn) {
  rebuildBtn.addEventListener("click", async () => {
    const viewer = window.PhotoViewer3D;
    const img = viewer && viewer.getOriginalImage();
    if (!img) {
      setStatus("Сначала загрузите фото выше.");
      return;
    }

    rebuildBtn.disabled = true;
    setStatus("Загружаю модель оценки глубины (в первый раз — до минуты, дальше быстрее)...");

    try {
      const estimator = await getEstimator((progress) => {
        if (progress && progress.status === "progress" && typeof progress.progress === "number") {
          setStatus("Загрузка модели: " + Math.round(progress.progress) + "%");
        }
      });

      setStatus("Оцениваю, что на фото ближе, а что дальше...");
      const output = await estimator(img.src);
      const depthCanvas = rawDepthToCanvas(output.depth);

      viewer.rebuildRelief(img, depthCanvas);
      setStatus("Готово! Вращайте карточку мышью — обратная сторона объектов на фото не видна, поэтому не восстанавливается.");
    } catch (err) {
      console.error("depth estimation failed", err);
      setStatus("Не получилось восстановить объём (" + (err && err.message ? err.message : "неизвестная ошибка") + "). Оставил обычную плоскую карточку.");
    } finally {
      rebuildBtn.disabled = false;
    }
  });
}
