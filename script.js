/**
 * Photo Moment · Abi & Puput
 * Camera + Upload + Local Gallery
 *
 * CATATAN PENTING TENTANG GOOGLE DRIVE:
 * Upload langsung ke folder Google Drive dari browser memerlukan
 * Google Cloud Project + OAuth Client ID. Karena itu, solusi praktis:
 * 1. Foto disimpan di galeri lokal (IndexedDB) di perangkat tamu.
 * 2. Tombol "Simpan & Upload" akan menyimpan ke galeri + membuka
 *    folder Google Drive agar tamu bisa drag & drop / upload manual.
 * 3. Atau gunakan Google Apps Script (lihat README) untuk upload otomatis.
 */

const FOLDER_ID = '1T9cY5FAOQHv8Axvu1--CEijVpb_uXyR6';
const DRIVE_URL = `https://drive.google.com/drive/folders/${FOLDER_ID}`;

// ========== STATE ==========
let stream = null;
let currentFacingMode = 'user'; // 'user' | 'environment'
let capturedBlob = null;
let db = null; // IndexedDB

// ========== DOM ==========
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const cameraStatus = document.getElementById('camera-status');
const previewArea = document.getElementById('preview-area');
const previewImg = document.getElementById('preview-img');
const btnCapture = document.getElementById('btn-capture');
const btnSwitch = document.getElementById('btn-switch');
const btnRetake = document.getElementById('btn-retake');
const btnSaveCamera = document.getElementById('btn-save-camera');
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const uploadList = document.getElementById('upload-list');
const galleryGrid = document.getElementById('gallery-grid');
const galleryEmpty = document.getElementById('gallery-empty');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const toastEl = document.getElementById('toast');

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  await initDB();
  await startCamera();
  loadGallery();
  initUpload();
  initLightbox();
});

// ========== TABS ==========
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');

      // Restart camera when switching to camera tab
      if (btn.dataset.tab === 'camera' && !stream) {
        startCamera();
      }
    });
  });
}

// ========== CAMERA ==========
async function startCamera() {
  stopCamera();
  cameraStatus.textContent = 'Menyalakan kamera...';
  cameraStatus.style.display = 'block';

  const constraints = {
    video: {
      facingMode: currentFacingMode,
      width: { ideal: 1280 },
      height: { ideal: 1280 }
    },
    audio: false
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      cameraStatus.style.display = 'none';
    };
  } catch (err) {
    console.error(err);
    cameraStatus.textContent = 'Kamera tidak tersedia. Izinkan akses kamera di browser.';
    showToast('Gagal mengakses kamera. Periksa izin browser.', 'error');
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

btnSwitch.addEventListener('click', () => {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  startCamera();
});

btnCapture.addEventListener('click', () => {
  if (!stream) return;

  const w = video.videoWidth;
  const h = video.videoHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Mirror if front camera
  if (currentFacingMode === 'user') {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, w, h);

  canvas.toBlob(blob => {
    capturedBlob = blob;
    previewImg.src = URL.createObjectURL(blob);
    previewArea.classList.remove('hidden');
    video.style.display = 'none';
    document.querySelector('.camera-overlay').style.display = 'none';
    document.querySelector('.camera-controls').style.display = 'none';
  }, 'image/jpeg', 0.92);
});

btnRetake.addEventListener('click', () => {
  capturedBlob = null;
  previewArea.classList.add('hidden');
  video.style.display = 'block';
  document.querySelector('.camera-overlay').style.display = 'block';
  document.querySelector('.camera-controls').style.display = 'flex';
  if (!stream) startCamera();
});

btnSaveCamera.addEventListener('click', async () => {
  if (!capturedBlob) return;
  btnSaveCamera.disabled = true;
  btnSaveCamera.textContent = 'Menyimpan...';

  try {
    const name = `camera_${Date.now()}.jpg`;
    await saveToGallery(capturedBlob, name, 'camera');
    showToast('Foto disimpan di galeri!', 'success');

    // Buka Google Drive agar user bisa upload
    // (alternatif: implementasikan Google Apps Script)
    setTimeout(() => {
      if (confirm('Foto sudah disimpan di galeri perangkat ini.\n\nBuka folder Google Drive untuk mengunggah foto ke album bersama?')) {
        window.open(DRIVE_URL, '_blank');
      }
    }, 600);

    // Reset preview
    btnRetake.click();
  } catch (e) {
    console.error(e);
    showToast('Gagal menyimpan foto', 'error');
  } finally {
    btnSaveCamera.disabled = false;
    btnSaveCamera.textContent = 'Simpan & Upload';
  }
});

// ========== UPLOAD (file picker) ==========
function initUpload() {
  dropZone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') fileInput.click();
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
    fileInput.value = '';
  });
}

async function handleFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if (!files.length) {
    showToast('Pilih file gambar saja', 'error');
    return;
  }

  for (const file of files) {
    const item = createUploadItem(file);
    uploadList.appendChild(item.el);

    try {
      await saveToGallery(file, file.name, 'upload');
      item.setStatus('Tersimpan di galeri ✓', 'success');
      showToast(`${file.name} disimpan`, 'success');
    } catch (err) {
      item.setStatus('Gagal menyimpan', 'error');
    }
  }

  // Tawarkan buka Drive
  setTimeout(() => {
    if (confirm('Foto sudah disimpan di galeri.\n\nBuka folder Google Drive untuk mengunggah ke album bersama?')) {
      window.open(DRIVE_URL, '_blank');
    }
  }, 800);
}

function createUploadItem(file) {
  const el = document.createElement('div');
  el.className = 'upload-item';
  const url = URL.createObjectURL(file);
  el.innerHTML = `
    <img src="${url}" alt="">
    <div class="upload-item-info">
      <div class="upload-item-name">${escapeHtml(file.name)}</div>
      <div class="upload-item-status">Menyimpan...</div>
    </div>
  `;
  return {
    el,
    setStatus(text, cls) {
      const s = el.querySelector('.upload-item-status');
      s.textContent = text;
      s.className = 'upload-item-status ' + (cls || '');
    }
  };
}

// ========== INDEXEDDB (local gallery) ==========
function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('PhotoMomentAbiPuput', 1);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains('photos')) {
        database.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

function saveToGallery(blobOrFile, name, source) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = {
        name,
        source,
        dataUrl: reader.result,
        createdAt: new Date().toISOString()
      };
      const tx = db.transaction('photos', 'readwrite');
      const store = tx.objectStore('photos');
      const req = store.add(data);
      req.onsuccess = () => {
        loadGallery();
        resolve();
      };
      req.onerror = () => reject(req.error);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blobOrFile);
  });
}

function loadGallery() {
  if (!db) return;
  const tx = db.transaction('photos', 'readonly');
  const store = tx.objectStore('photos');
  const req = store.getAll();
  req.onsuccess = () => {
    const photos = req.result.reverse(); // newest first
    renderGallery(photos);
  };
}

function renderGallery(photos) {
  // Keep empty state element, clear others
  const items = galleryGrid.querySelectorAll('.gallery-item');
  items.forEach(i => i.remove());

  if (!photos.length) {
    galleryEmpty.style.display = 'block';
    return;
  }
  galleryEmpty.style.display = 'none';

  photos.forEach(photo => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.innerHTML = `
      <img src="${photo.dataUrl}" alt="${escapeHtml(photo.name)}" loading="lazy">
      <div class="gallery-item-label">${escapeHtml(photo.name)}</div>
    `;
    div.addEventListener('click', () => openLightbox(photo.dataUrl));
    galleryGrid.appendChild(div);
  });
}

document.getElementById('btn-refresh-gallery').addEventListener('click', loadGallery);

// ========== LIGHTBOX ==========
function initLightbox() {
  document.getElementById('lightbox-close').addEventListener('click', () => {
    lightbox.classList.add('hidden');
  });
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) lightbox.classList.add('hidden');
  });
}

function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.classList.remove('hidden');
}

// ========== TOAST ==========
function showToast(msg, type = '') {
  toastEl.textContent = msg;
  toastEl.className = 'toast ' + type;
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3200);
}

// ========== HELPERS ==========
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Mirror front camera video for better UX
video.addEventListener('loadedmetadata', () => {
  if (currentFacingMode === 'user') {
    video.style.transform = 'scaleX(-1)';
  } else {
    video.style.transform = 'none';
  }
});
