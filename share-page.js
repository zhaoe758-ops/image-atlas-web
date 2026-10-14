// Build a self-contained, read-only copy. No storage, fetches, or modules remain.
const inlineJSON = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export function assembleSharePage({ shell, css, script, records, assets, license, photoActions }) {
  if (!records.length) throw new Error('没有可分享的图片。');
  if (assets.some(asset => !/^data:image\//.test(asset))) throw new Error('图片尚未完整打包。');
  const compact = records.map(record => {
    const { id, title, description, tags, aspect, date, year, dateSource, sourceFile, src, full } = record;
    if (!Number.isInteger(src) || !Number.isInteger(full) || !assets[src] || !assets[full]) throw new Error('缺少图片资源。');
    return { id, title, description, tags, aspect, date, year, dateSource, sourceFile, src, full };
  });
  if (!photoActions) throw new Error('原图查看器尚未完整加载，请刷新后重试。');
  const runtime = photoActions.replace(/^export /gm, '') + '\n' + script.replace(/^import[^\n]+\n/gm, '').replace(/^mountLibrary\(\);?\s*$/gm, '').replace(/^mountShare\([^\n]+\);?\s*$/gm, '');
  const boot = `const atlasAssets=${inlineJSON(assets)};\nconst images=${inlineJSON(compact)}.map(r=>({...r,src:atlasAssets[r.src],full:atlasAssets[r.full]}));\nconst isDemo=images.every(r=>r.dateSource==='demo');\n`;
  let html = shell.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, '')
    .replace(/<script\b[^>]*src="[^"]+"[^>]*><\/script>/g, '')
    .replace(/<dialog\b[^>]*id="(?:library-dialog|share-dialog)"[^>]*>[\s\S]*?<\/dialog>/g, '')
    .replace(/<button\b[^>]*id="(?:open-library|open-share)"[^>]*>[\s\S]*?<\/button>/g, '')
    .replace(/<p\b[^>]*id="app-notice"[^>]*>[\s\S]*?<\/p>/g, '')
    .replace('IMAGE ATLAS · 图像图集', 'IMAGE ATLAS · 分享图集')
    .replace('长按照片进行编辑', '长按查看原图');
  html = html.replace('</head>', () => `<meta name="referrer" content="no-referrer"><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head>`);
  return html.replace('</body>', () => `<script type="application/json" id="atlas-license">${inlineJSON(license)}</script><script>${(boot+runtime).replace(/<\/script/gi,'<\\/script')}</script></body>`);
}
