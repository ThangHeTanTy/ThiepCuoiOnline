// Dựng thư mục dist/ để đưa lên GitHub Pages: chép site/, ghi config.js, tạo m/<mã>/index.html cho từng khách.
// Chạy: node scripts/build.mjs   (không có APPS_SCRIPT_URL + BUILD_KEY thì tạo bản thử với dữ liệu mẫu)
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const { APPS_SCRIPT_URL = '', BUILD_KEY = '', GOOGLE_CLIENT_ID = '' } = process.env;
const live = Boolean(APPS_SCRIPT_URL && BUILD_KEY);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dmy = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };

async function getData() {
  if (!live) {
    console.log('Không có APPS_SCRIPT_URL/BUILD_KEY: tạo bản thử với dữ liệu mẫu (m/demo1/).');
    return { cfg: { groom: 'Minh Quân', bride: 'Thu Hà', date: '2026-12-19', siteUrl: process.env.SITE_URL || '' }, guests: [{ code: 'demo1', name: 'Anh Tuấn & chị Mai', addr: 'Anh chị' }] };
  }
  const url = `${APPS_SCRIPT_URL}?action=build&key=${encodeURIComponent(BUILD_KEY)}`;
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  let j; try { j = JSON.parse(text); } catch { throw new Error('Apps Script không trả JSON. Kiểm tra lại URL Web App và quyền "Bất kỳ ai". Trả về: ' + text.slice(0, 200)); }
  if (!j.ok) throw new Error('Apps Script báo lỗi: ' + j.error);
  return j;
}

const data = await getData();
const site = (process.env.SITE_URL || data.cfg.siteUrl || '').replace(/\/?$/, '/');
if (site === '/') console.warn('Cảnh báo: chưa có dia_chi_trang (tab CaiDat) nên ảnh xem trước trên Zalo có thể không hiện.');

await rm(DIST, { recursive: true, force: true });
await cp(join(ROOT, 'site'), DIST, { recursive: true });
await writeFile(join(DIST, '.nojekyll'), '');
const landing = await readFile(join(ROOT, 'site', 'index.html'), 'utf8');
await writeFile(join(DIST, '404.html'), site !== '/' ? landing.replace('<head>', `<head>\n<base href="${esc(site)}">`) : landing);
await writeFile(join(DIST, 'config.js'),
  `window.THIEP = Object.assign({}, window.THIEP, ${JSON.stringify({ apiUrl: live ? APPS_SCRIPT_URL : '', googleClientId: GOOGLE_CLIENT_ID, demo: !live })});\n`);

const tpl = await readFile(join(ROOT, 'templates', 'thiep.html'), 'utf8');
const { groom, bride, date } = data.cfg;
for (const g of data.guests) {
  if (!/^[a-z0-9]{4,12}$/.test(g.code)) { console.warn('Bỏ qua mã không hợp lệ:', g.code); continue; }
  const title = `Thiệp mời riêng gửi ${g.name}`;
  const desc = `${groom} & ${bride} trân trọng kính mời ${g.addr} đến dự lễ thành hôn${dmy(date) ? ' ngày ' + dmy(date) : ''}.`;
  const html = tpl
    .replaceAll('{{TITLE}}', esc(title)).replaceAll('{{DESC}}', esc(desc))
    .replaceAll('{{OG_IMAGE}}', esc(site + 'assets/og.jpg')).replaceAll('{{OG_URL}}', esc(site + 'm/' + g.code + '/'))
    .replaceAll('{{BASE}}', '../../').replaceAll('{{CODE}}', g.code);
  const dir = join(DIST, 'm', g.code);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), html);
}
console.log(`Xong: ${data.guests.length} thiệp riêng trong dist/m/ (${live ? 'dữ liệu thật' : 'bản thử'}).`);
