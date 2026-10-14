import { assembleSharePage } from './share-page.js';

async function getText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('页面资源未能完整加载，请刷新后再试。');
  return response.text();
}

async function imageData(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('有图片无法读取，请重新打开图集后再试。');
  const blob = await response.blob();
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('图片打包失败。'));
    reader.readAsDataURL(blob);
  });
}

export function mountShare(images, isDemo) {
  const dialog = document.querySelector('#share-dialog');
  const action = document.querySelector('#export-share');
  const status = document.querySelector('#share-status');
  const downloadLink = document.querySelector('#share-download');
  const close = dialog.querySelector('button[aria-label]');
  let busy = false, downloadURL = null;
  document.querySelector('#share-summary').textContent = isDemo
    ? `当前是 ${images.length} 张示例图片。添加自己的照片后，可以再次导出。`
    : `将包含当前图集的 ${images.length} 张照片及其标题和日期。`;
  document.querySelector('#open-share').addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  action.addEventListener('click', async () => {
    if (busy) return;
    busy = true; action.disabled = true; close.disabled = true;
    try {
      status.textContent = '正在打包页面…';
      const [shell, baseStyle, libraryStyle, script, license, photoActions] = await Promise.all([
        getText('index.html'), getText('styles.css'), getText('library.css'), getText('app.js'), getText('LICENSE'), getText('photo-actions.js')
      ]);
      const paths = [...new Set(images.flatMap(image => [image.src,image.full]))];
      const assets = [], positions = new Map();
      for (let i=0;i<paths.length;i++) {
        status.textContent = `正在打包图片 ${i+1} / ${paths.length}…`;
        positions.set(paths[i],i); assets.push(await imageData(paths[i]));
      }
      const records = images.map(record => ({...record,src:positions.get(record.src),full:positions.get(record.full)}));
      const html = assembleSharePage({shell,css:baseStyle+'\n'+libraryStyle,script,records,assets,license,photoActions});
      const blob = new Blob([html],{type:'text/html;charset=utf-8'});
      if (downloadURL) URL.revokeObjectURL(downloadURL);
      downloadURL = URL.createObjectURL(blob);
      downloadLink.href = downloadURL; downloadLink.hidden = false;
      status.textContent = `分享网页已准备好（${(blob.size/1024/1024).toFixed(1)} MB）。点击下方链接保存，再把 HTML 文件发给朋友，用电脑浏览器打开。`;
    } catch (error) { status.textContent = error.message || '导出未完成，请重试。'; }
    finally { busy = false; action.disabled = false; close.disabled = false; }
  });
  addEventListener('pagehide', () => { if (downloadURL) URL.revokeObjectURL(downloadURL); }, {once:true});
}
