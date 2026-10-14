import { images as demoImages } from './gallery.js';
import { readPhotos, savePhoto, preparePhoto, displayRecords } from './storage.js';

let saved = [], storageError = '';
try { saved = await readPhotos(); }
catch { storageError = '浏览器存储暂不可用。你仍可浏览示例；请使用普通浏览窗口后再添加照片。'; }
export const isDemo = new URL(location.href).searchParams.get('demo') === '1' || saved.length === 0;
export const initialImages = isDemo ? demoImages : displayRecords(saved);

export function mountLibrary() {
  const $ = selector => document.querySelector(selector);
  const dialog = $('#library-dialog'), input = $('#photo-files'), submit = $('#import-submit');
  const status = $('#library-status'), yearInput = $('#import-year');
  let files = [], importing = false, added = 0;
  const goToPhotos = () => { const url = new URL(location.href); url.searchParams.delete('demo'); location.assign(url); };
  $('#open-library').addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && !importing && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('cancel', event => { if (importing) event.preventDefault(); });
  dialog.addEventListener('close', () => { if (added) goToPhotos(); });
  if (saved.length) {
    $('.library-intro').textContent = '你的照片已经在这里。继续添加新的片刻，或切换到示例预览。';
    $('#library-count').textContent = `已保存 ${saved.length} 张照片`;
    const toggle = $('#toggle-demo'); toggle.hidden = false;
    toggle.textContent = isDemo ? '回到我的图集' : '查看示例';
    toggle.addEventListener('click', () => {
      const url = new URL(location.href);
      isDemo ? url.searchParams.delete('demo') : url.searchParams.set('demo', '1');
      location.assign(url);
    });
  }
  if (storageError) {
    const notice = $('#app-notice'); notice.hidden = false; notice.textContent = storageError;
    status.textContent = storageError; input.disabled = true;
  }
  function choose(chosen) {
    if (importing || storageError) return;
    files = Array.from(chosen); submit.disabled = files.length === 0;
    $('#file-summary').textContent = files.length ? `已选择 ${files.length} 个文件` : '支持 JPG、PNG、WebP，可一次选择多张';
    status.textContent = ''; submit.textContent = '添加到我的图集';
  }
  input.addEventListener('change', () => choose(input.files));
  const drop = $('#file-drop');
  for (const type of ['dragenter', 'dragover']) drop.addEventListener(type, event => {
    event.preventDefault(); if (!importing) drop.classList.add('drag-over');
  });
  for (const type of ['dragleave', 'drop']) drop.addEventListener(type, event => {
    event.preventDefault(); drop.classList.remove('drag-over');
  });
  drop.addEventListener('drop', event => choose(event.dataTransfer.files));
  $('#import-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (importing || !files.length || storageError) return;
    const year = yearInput.value ? Number(yearInput.value) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
      status.textContent = '请输入 1900 至 2100 之间的完整年份。'; return;
    }
    importing = true; submit.disabled = true; input.disabled = true; yearInput.disabled = true;
    $('.close-dialog').disabled = true; $('#toggle-demo').disabled = true;
    const existing = new Set(saved.map(photo => photo.id));
    let duplicates = 0; const failed = [];
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      status.textContent = `正在保存 ${index + 1} / ${files.length}：${file.name}`;
      try {
        const record = await preparePhoto(file, year);
        if (existing.has(record.id)) { duplicates++; continue; }
        await savePhoto(record); existing.add(record.id); saved.push(record); added++;
      } catch (error) {
        failed.push(file.name);
        if (error.name === 'QuotaExceededError') {
          status.textContent = '浏览器空间不足。已保存的照片会保留，请先减少所选照片数量。';
          failed.push(...files.slice(index + 1).map(photo => photo.name)); break;
        }
      }
    }
    importing = false; $('.close-dialog').disabled = false; $('#toggle-demo').disabled = false;
    input.disabled = false; yearInput.disabled = false;
    $('#library-count').textContent = `已保存 ${saved.length} 张照片`;
    if (added && failed.length === 0) { goToPhotos(); return; }
    status.textContent = `${added ? `已保存 ${added} 张。` : ''}${duplicates ? `跳过 ${duplicates} 张重复照片。` : ''}${failed.length ? `未导入 ${failed.length} 个文件：${failed.slice(0,3).join('、')}${failed.length > 3 ? '…' : ''}。请确认格式及浏览器存储空间。` : ''}${added ? '关闭此窗口即可查看已保存的照片。' : ''}`;
    files = []; input.value = ''; $('#file-summary').textContent = '可以重新选择照片';
  });
}
