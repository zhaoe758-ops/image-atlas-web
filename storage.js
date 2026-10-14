const DATABASE = 'image-atlas-personal-v1';
let connection;

function database() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('请关闭其他图集页面后重试。'));
  });
  return connection;
}

export async function readPhotos() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('photos').objectStore('photos').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePhoto(record) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('photos', 'readwrite');
    transaction.objectStore('photos').put(record);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('照片保存失败。'));
    transaction.onerror = () => {};
  });
}

export async function deletePhoto(id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('photos', 'readwrite');
    transaction.objectStore('photos').delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('照片删除失败，请重试。'));
    transaction.onerror = () => {};
  });
}

export async function updatePhotoDetails(id, details) {
  const title = String(details.title ?? '').trim();
  const description = String(details.description ?? '').trim();
  if (!title || title.length > 80) throw new Error('请填写 1–80 字的照片标题。');
  if (description.length > 2000) throw new Error('照片介绍最多 2000 字。');
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('photos', 'readwrite');
    const store = transaction.objectStore('photos');
    const request = store.get(id);
    let missing = false;
    request.onsuccess = () => {
      if (!request.result) { missing = true; transaction.abort(); return; }
      // Read and merge in one transaction; keep the original file and thumbnail intact.
      store.put({ ...request.result, title, description });
    };
    transaction.oncomplete = () => resolve({ title, description });
    transaction.onabort = () => reject(missing
      ? new Error('这张照片已被删除，请刷新图集后重试。')
      : transaction.error || new Error('保存失败，请重试。'));
    transaction.onerror = () => {};
  });
}

export async function preparePhoto(file, yearOverride) {
  if (!/\.(jpe?g|png|webp)$/i.test(file.name)) throw new Error('请使用 JPG、PNG 或 WebP 照片。');
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const id = 'photo-' + Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  const image = await createImageBitmap(file);
  try {
    if (!image.width || !image.height) throw new Error('无法读取图片尺寸。');
    const scale = Math.min(1, 480 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fafcfb';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const thumbnail = await new Promise((resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('缩略图生成失败。')), 'image/jpeg', .85));
    const timestamp = new Date(file.lastModified);
    if (!yearOverride && !Number.isFinite(timestamp.getTime())) throw new Error('文件日期无法读取，请指定归档年份。');
    const year = yearOverride || timestamp.getFullYear();
    const date = yearOverride ? `${year}-01-01` : `${year}-${String(timestamp.getMonth()+1).padStart(2,'0')}-${String(timestamp.getDate()).padStart(2,'0')}`;
    return {
      id, title: file.name.replace(/\.[^.]+$/, ''), tags: file.name,
      sourceFile: file.name, date, year, dateSource: yearOverride ? 'manual' : 'file',
      aspect: image.width / image.height, original: file, thumbnail
    };
  } finally { image.close(); }
}

export function displayRecords(records) {
  return [...records].sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map(({ original, thumbnail, ...record }) => ({ ...record,
      src: URL.createObjectURL(thumbnail), full: URL.createObjectURL(original) }));
}
