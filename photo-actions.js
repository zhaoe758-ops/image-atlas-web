// Original files are displayed directly; thumbnails are never enlarged here.
export function mountPhotoActions({ canDelete, onDelete, canEdit = false, onEdit }) {
  const $ = selector => document.querySelector(selector);
  const menu = $('#photo-actions'), confirm = $('#delete-confirm'), viewer = $('#original-viewer');
  const image = $('#original-image'), stage = $('#original-stage');
  const editor = $('#photo-editor'), titleInput = $('#edit-photo-title'), descriptionInput = $('#edit-photo-description');
  let saving = false;
  let record = null, deleting = false, scale = 1, fitScale = 1, fitted = true, loaded = false;
  let gesture = null;
  const touches = new Map();
  const deleteButton = $('#delete-photo');
  deleteButton.hidden = !canDelete;
  $('#edit-photo').hidden = !canEdit;
  $('#photo-actions-note').textContent = canDelete
    ? '查看原图、编辑照片介绍，或删除当前浏览器中的照片。'
    : '可查看原图与照片介绍。示例和分享图集仅供浏览。';
  function open(next) {
    if (!next || document.querySelector('dialog[open]')) return;
    record = next;
    $('#photo-actions-name').textContent = `${record.date} · ${record.title}`;
    menu.showModal();
  }
  for (const dialog of [menu, viewer, confirm]) dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && !deleting && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  $('#edit-photo').addEventListener('click', () => {
    if (!canEdit) return;
    titleInput.value = record.title; descriptionInput.value = record.description || '';
    $('#edit-status').textContent = ''; titleInput.setCustomValidity('');
    updateCount(); menu.close(); editor.showModal();
  });
  function updateCount() { $('#description-count').textContent = `${descriptionInput.value.length} / 2000`; }
  descriptionInput.addEventListener('input', updateCount);
  titleInput.addEventListener('input', () => titleInput.setCustomValidity(''));
  $('#cancel-edit').addEventListener('click', () => { if (!saving) editor.close(); });
  editor.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
  $('#photo-edit-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!canEdit || saving) return;
    titleInput.setCustomValidity(titleInput.value.trim() ? '' : '请填写照片标题。');
    if (!event.currentTarget.reportValidity()) return;
    saving = true;
    for (const control of [titleInput, descriptionInput, $('#save-edit'), $('#cancel-edit')]) control.disabled = true;
    $('#edit-status').textContent = '正在保存…';
    try {
      await onEdit(record, { title: titleInput.value, description: descriptionInput.value });
      editor.close();
    } catch (error) { $('#edit-status').textContent = error.message || '保存失败，请重试。'; }
    finally {
      saving = false;
      for (const control of [titleInput, descriptionInput, $('#save-edit'), $('#cancel-edit')]) control.disabled = false;
    }
  });
  function zoom(next, center = { x: stage.clientWidth / 2, y: stage.clientHeight / 2 }) {
    if (!loaded) return;
    const oldWidth = image.width, oldHeight = image.height;
    const px = (stage.scrollLeft + center.x - Math.max(0, (stage.clientWidth - oldWidth) / 2)) / scale;
    const py = (stage.scrollTop + center.y - Math.max(0, (stage.clientHeight - oldHeight) / 2)) / scale;
    scale = Math.min(4, Math.max(Math.min(.05, fitScale), next));
    image.style.width = `${Math.max(1, Math.round(image.naturalWidth * scale))}px`;
    image.style.height = `${Math.max(1, Math.round(image.naturalHeight * scale))}px`;
    stage.scrollLeft = px * scale + Math.max(0, (stage.clientWidth - image.width) / 2) - center.x;
    stage.scrollTop = py * scale + Math.max(0, (stage.clientHeight - image.height) / 2) - center.y;
    $('#original-zoom').textContent = `${Math.round(scale * 100)}%`;
    $('#original-out').disabled = scale <= Math.min(.05, fitScale);
    $('#original-in').disabled = scale >= 4;
  }
  function fit() {
    if (!loaded) return;
    fitScale = Math.min(1, stage.clientWidth / image.naturalWidth, stage.clientHeight / image.naturalHeight);
    fitted = true; zoom(fitScale); stage.scrollTo(0, 0);
  }
  function enableTools(enabled) {
    for (const button of document.querySelectorAll('.original-tools button')) button.disabled = !enabled;
  }
  $('#view-original').addEventListener('click', () => {
    menu.close(); loaded = false; fitted = true; enableTools(false); image.hidden = true;
    $('#original-title').textContent = record.title;
    $('#original-description').textContent = record.description || '';
    $('#original-description').hidden = !record.description;
    $('#original-info').textContent = '正在加载原图…';
    $('#original-zoom').textContent = '—';
    image.alt = record.title; viewer.showModal();
    image.onload = () => {
      loaded = true; image.hidden = false; enableTools(true);
      $('#original-info').textContent = `${record.date} · ${image.naturalWidth} × ${image.naturalHeight} 像素`;
      fit();
    };
    image.onerror = () => { $('#original-info').textContent = '原图加载失败，请关闭后重新打开。'; };
    image.src = record.full;
  });
  viewer.addEventListener('close', () => {
    image.onload = image.onerror = null; image.removeAttribute('src');
    loaded = false; touches.clear(); gesture = null;
  });
  $('#original-fit').addEventListener('click', fit);
  $('#original-actual').addEventListener('click', () => { fitted = false; zoom(1); });
  $('#original-in').addEventListener('click', () => { fitted = false; zoom(scale * 1.5); });
  $('#original-out').addEventListener('click', () => { fitted = false; zoom(scale / 1.5); });
  addEventListener('resize', () => { if (viewer.open && fitted) fit(); });
  function startGesture() {
    const points = [...touches.values()];
    if (points.length === 1) gesture = { x: points[0].x, y: points[0].y, left: stage.scrollLeft, top: stage.scrollTop };
    else if (points.length === 2) gesture = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), scale };
    else gesture = null;
  }
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !loaded) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.setPointerCapture(event.pointerId); startGesture();
  });
  stage.addEventListener('pointermove', event => {
    if (!touches.has(event.pointerId) || !gesture) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...touches.values()];
    if (points.length === 2 && gesture.distance > 0) {
      fitted = false;
      const bounds = stage.getBoundingClientRect();
      zoom(gesture.scale * Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) / gesture.distance,
        { x: (points[0].x + points[1].x) / 2 - bounds.left, y: (points[0].y + points[1].y) / 2 - bounds.top });
    } else if (points.length === 1) {
      stage.scrollLeft = gesture.left - (event.clientX - gesture.x);
      stage.scrollTop = gesture.top - (event.clientY - gesture.y);
    }
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(type, event => {
    touches.delete(event.pointerId); startGesture();
  });
  stage.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault(); fitted = false;
      const bounds = stage.getBoundingClientRect();
      zoom(scale * Math.exp(-event.deltaY * .01), { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    }
  }, { passive: false });
  deleteButton.addEventListener('click', () => {
    if (!canDelete) return;
    menu.close(); $('#delete-name').textContent = record.title; $('#delete-status').textContent = ''; confirm.showModal();
  });
  $('#cancel-delete').addEventListener('click', () => { if (!deleting) confirm.close(); });
  confirm.addEventListener('cancel', event => { if (deleting) event.preventDefault(); });
  $('#confirm-delete').addEventListener('click', async () => {
    if (!canDelete || deleting) return;
    deleting = true; $('#confirm-delete').disabled = $('#cancel-delete').disabled = true;
    $('#delete-status').textContent = '正在删除…';
    try { await onDelete(record); }
    catch { $('#delete-status').textContent = '删除失败，照片已保留。请重试。'; }
    finally { deleting = false; $('#confirm-delete').disabled = $('#cancel-delete').disabled = false; }
  });
  return { open };
}
