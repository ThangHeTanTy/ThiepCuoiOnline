/**
 * THIỆP CƯỚI ONLINE – máy chủ chạy trên Google Apps Script, dữ liệu nằm trong Google Sheet.
 *
 * Cách dùng nhanh (chi tiết trong README.md):
 *   1. Tạo một Google Sheet trống → Tiện ích mở rộng → Apps Script → dán file này (và appsscript.json).
 *   2. Chạy hàm setup() một lần → Sheet có đủ các tab: CaiDat, NghiLe, LoTrinh, Khach, Admin.
 *   3. Khai báo Script Properties (Cài đặt dự án → Thuộc tính tập lệnh):
 *        OWNER_EMAIL      Gmail chủ thiệp (cấp cao nhất)
 *        GOOGLE_CLIENT_ID OAuth Client ID (loại Web) dùng cho nút "Đăng nhập bằng Google" ở trang admin
 *        BUILD_KEY        chuỗi bí mật bất kỳ, trùng với secret BUILD_KEY trên GitHub
 *        GH_TOKEN         (tùy chọn) fine-grained token GitHub có quyền Actions: Read and write
 *        GH_REPO          (tùy chọn) ten-ban/ten-repo
 *        GH_WORKFLOW      (tùy chọn) deploy.yml
 *        GH_BRANCH        (tùy chọn) main
 *   4. Triển khai → Tùy chọn triển khai mới → Ứng dụng web: Thực thi với tư cách "Tôi", Ai có quyền truy cập "Bất kỳ ai".
 */

const TZ = 'Asia/Ho_Chi_Minh';

const SHEETS = {
  CaiDat: ['khoa', 'gia_tri', 'mo_ta'],
  NghiLe: ['ma', 'ten', 'to_chuc_tai', 'ngay', 'gio', 'dia_chi', 'link_ban_do', 'ghi_chu'],
  LoTrinh: ['ma_noi', 'ten_noi', 'tieu_de', 'mo_ta'],
  Khach: ['ma', 'ten_hien_thi', 'cach_goi', 'ben', 'so_ghe', 'nghi_le', 'den_tu', 'ghi_chu_noi_bo',
    'luot_xem', 'xem_lan_dau', 'xem_gan_nhat',
    'xac_nhan', 'so_nguoi', 'nghi_le_du', 'can_xe', 'can_phong', 'ghi_chu_khach', 'xac_nhan_luc',
    'loi_chuc', 'loi_chuc_luc',
    'qua_ben', 'qua_so_tien_bao', 'qua_bao_luc', 'sao_ke_so_tien', 'sao_ke_noi_dung', 'sao_ke_luc'],
  Admin: ['email', 'vai_tro', 'ghi_chu']
};

const BANKS = {
  'Vietcombank': '970436', 'VietinBank': '970415', 'BIDV': '970418', 'Agribank': '970405',
  'Techcombank': '970407', 'MB Bank': '970422', 'ACB': '970416', 'VPBank': '970432',
  'TPBank': '970423', 'Sacombank': '970403', 'VIB': '970441', 'SHB': '970443',
  'HDBank': '970437', 'OCB': '970448', 'SeABank': '970440', 'MSB': '970426'
};

const ROLES = {
  'Chủ thiệp': 'owner', 'Quản trị toàn bộ': 'full', 'Quản lý nhà gái': 'gai',
  'Quản lý nhà trai': 'trai', 'Chỉ xem': 'view'
};

/* ============================ CÀI ĐẶT BAN ĐẦU ============================ */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sample = {
    CaiDat: [
      ['chu_re', 'Minh Quân', 'Tên chú rể hiển thị trên thiệp'],
      ['co_dau', 'Thu Hà', 'Tên cô dâu'],
      ['ngay_cuoi', '', 'Ngày cưới dương lịch, dạng 2026-12-19. Để trống nếu chưa chốt'],
      ['am_lich', '', 'Ngày âm lịch tự nhập, ví dụ: 11 tháng 11 năm Bính Ngọ'],
      ['han_xac_nhan', '', 'Hạn khách xác nhận, dạng 2026-12-05'],
      ['so_khach_du_kien', 250, 'Chỉ hiện trên trang admin'],
      ['hien_huy_hieu', true, 'TRUE: hiện hình rồng phượng nét vàng dưới phong bì; FALSE: ẩn'],
      ['dia_chi_trang', 'https://ten-ban.github.io/thiep-cuoi-online/', 'Địa chỉ gốc của trang (có dấu / ở cuối). Link khách = địa chỉ này + m/<mã>/'],
      ['livestream', '', 'Link xem trực tiếp, để trống thì ẩn mục này'],
      ['nguoi_ho_tro', 'Anh Hoàng (em trai chú rể)', 'Người hỗ trợ khách ở xa'],
      ['sdt_ho_tro', '0905 000 111', 'Số điện thoại hỗ trợ'],
      ['nha_trai_bo_me', 'Ông Nguyễn Văn Thành\nBà Lê Thị Hoa', 'Mỗi người một dòng (Alt+Enter để xuống dòng)'],
      ['nha_trai_dia_chi', 'Hải Châu, Đà Nẵng', ''],
      ['nha_gai_bo_me', 'Ông Trần Đức Nghĩa\nBà Phạm Thị Lan', ''],
      ['nha_gai_dia_chi', 'Hội An, Quảng Nam', ''],
      ['ngan_hang_trai', 'Vietcombank', 'Chọn trong danh sách'],
      ['stk_trai', '', 'Số tài khoản nhận mừng nhà trai'],
      ['chu_tk_trai', '', 'Tên chủ tài khoản, viết hoa không dấu'],
      ['ngan_hang_gai', 'Techcombank', ''],
      ['stk_gai', '', 'Số tài khoản nhận mừng nhà gái'],
      ['chu_tk_gai', '', 'Tên chủ tài khoản, viết hoa không dấu']
    ],
    NghiLe: [
      ['vq', 'Lễ Vu Quy', 'Tư gia nhà gái', '', '08:00', 'Số 12 Trần Phú, Hội An', '', ''],
      ['th', 'Lễ Thành Hôn', 'Tư gia nhà trai', '', '10:30', 'Số 45 Lê Lợi, Hải Châu, Đà Nẵng', '', ''],
      ['tiec', 'Tiệc cưới', 'Nhà hàng / chung', '', '18:00', 'Sảnh Sen, Trung tâm tiệc cưới Sông Hàn, Đà Nẵng', '', 'Đón khách 17:30']
    ],
    LoTrinh: [
      ['hanoi', 'Hà Nội', 'Bay Nội Bài → Đà Nẵng', 'Khoảng 1 giờ 20 phút bay. Nên chọn chuyến hạ cánh trước 15:00.'],
      ['hanoi', 'Hà Nội', 'Sân bay → nơi ở / tiệc', 'Khoảng 10–15 phút taxi. Nếu chọn "Cần xe đón", nhà trai nhắn biển số xe trước một ngày.'],
      ['hcm', 'TP. Hồ Chí Minh', 'Bay Tân Sơn Nhất → Đà Nẵng', 'Khoảng 1 giờ 20 phút bay.'],
      ['', 'Tại chỗ', 'Gửi xe', 'Ô tô và xe máy gửi tại tầng hầm nơi tổ chức tiệc.']
    ],
    Khach: [
      ['', 'Anh Tuấn & chị Mai', 'Anh chị', 'trai', 2, 'tiec', 'hanoi', 'Bạn đại học'],
      ['', 'Bác Hai Lộc & gia đình', 'Bác và gia đình', 'trai', 4, 'th,tiec', '', ''],
      ['', 'Chị Ngọc Anh', 'Chị', 'gai', 1, 'vq,tiec', 'hcm', '']
    ],
    Admin: [['', 'Quản lý nhà gái', 'Ví dụ: Gmail của người nhà gái được ủy quyền']]
  };
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      const h = SHEETS[name];
      sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#f3e3c3');
      sh.setFrozenRows(1);
      const rows = sample[name] || [];
      if (rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows.map(r => r.concat(Array(h.length - r.length).fill(''))));
    }
  });
  // Ô chọn sẵn để nhập đúng giá trị
  const dv = list => SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build();
  ss.getSheetByName('Khach').getRange('D2:D1000').setDataValidation(dv(['trai', 'gai']));
  ss.getSheetByName('NghiLe').getRange('C2:C50').setDataValidation(dv(['Tư gia nhà trai', 'Tư gia nhà gái', 'Nhà hàng / chung']));
  ss.getSheetByName('Admin').getRange('B2:B100').setDataValidation(dv(Object.keys(ROLES).filter(r => r !== 'Chủ thiệp')));
  const cd = ss.getSheetByName('CaiDat');
  const keys = cd.getRange(2, 1, Math.max(1, cd.getLastRow() - 1), 1).getValues().map(r => r[0]);
  ['ngan_hang_trai', 'ngan_hang_gai'].forEach(k => { const i = keys.indexOf(k); if (i >= 0) cd.getRange(i + 2, 2).setDataValidation(dv(Object.keys(BANKS))); });
  // Ngày/giờ để dạng chữ cho khỏi bị Sheets tự đổi múi giờ
  ss.getSheetByName('NghiLe').getRange('D2:E50').setNumberFormat('@');
  ensureCodes_();
  SpreadsheetApp.getActive().toast('Đã tạo xong các tab. Hãy điền CaiDat, NghiLe, Khach rồi triển khai Web App.', 'Thiệp cưới', 8);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Thiệp cưới')
    .addItem('Tạo mã cho khách mới', 'menuCodes')
    .addItem('Xuất bản lại thiệp (GitHub)', 'menuRebuild')
    .addItem('Kiểm tra cài đặt', 'menuCheck')
    .addToUi();
}
function menuCodes() { const n = ensureCodes_(); SpreadsheetApp.getActive().toast(`Đã tạo mã cho ${n} khách.`, 'Thiệp cưới'); }
function menuRebuild() { const r = triggerRebuild_(); SpreadsheetApp.getActive().toast(r.ok ? 'Đã yêu cầu GitHub xuất bản lại (vài phút).' : r.error, 'Thiệp cưới', 8); }
function menuCheck() {
  const p = PropertiesService.getScriptProperties().getProperties(), cfg = readConfig_(), miss = [];
  ['OWNER_EMAIL', 'GOOGLE_CLIENT_ID', 'BUILD_KEY'].forEach(k => { if (!p[k]) miss.push('Thiếu Script Property ' + k); });
  ['trai', 'gai'].forEach(s => { if (!cfg.bank[s].acc) miss.push('Chưa nhập số tài khoản nhà ' + s); if (!cfg.bank[s].bin) miss.push('Ngân hàng nhà ' + s + ' chưa có trong danh sách'); });
  if (!/\/$/.test(cfg.siteUrl)) miss.push('dia_chi_trang phải kết thúc bằng dấu /');
  SpreadsheetApp.getUi().alert(miss.length ? 'Cần sửa:\n- ' + miss.join('\n- ') : 'Cài đặt ổn.');
}

/* ============================ ĐỌC / GHI SHEET ============================ */

function sheet_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }

function table_(name) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();
  const headers = values.shift() || [];
  const rows = values.map((r, i) => {
    const o = { _row: i + 2 };
    headers.forEach((h, j) => { o[h] = r[j]; });
    return o;
  }).filter(o => headers.some(h => o[h] !== '' && o[h] !== null));
  return { sh, headers, rows };
}

function writeRow_(t, row, patch) {
  Object.keys(patch).forEach(k => {
    const c = t.headers.indexOf(k);
    if (c >= 0) t.sh.getRange(row._row, c + 1).setValue(patch[k]);
    row[k] = patch[k];
  });
}

function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function dateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const s = str_(v); const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
}
function timeStr_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'HH:mm') : str_(v); }
function ms_(v) { return v instanceof Date ? v.getTime() : (v ? Number(v) || null : null); }
function bool_(v) { return v === true || /^(true|x|có|co|1)$/i.test(str_(v)); }
function noAccent_(s) { return str_(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D'); }

function readConfig_() {
  const kv = {};
  table_('CaiDat').rows.forEach(r => { kv[str_(r.khoa)] = r.gia_tri; });
  const bank = side => {
    const name = str_(kv['ngan_hang_' + side]);
    return { bankName: name, bin: BANKS[name] || (/^\d{6}$/.test(name) ? name : ''), acc: str_(kv['stk_' + side]).replace(/\s/g, ''), holder: noAccent_(kv['chu_tk_' + side]).toUpperCase() };
  };
  let site = str_(kv.dia_chi_trang); if (site && !/\/$/.test(site)) site += '/';
  return {
    groom: str_(kv.chu_re), bride: str_(kv.co_dau), date: dateStr_(kv.ngay_cuoi), lunar: str_(kv.am_lich),
    rsvpBy: dateStr_(kv.han_xac_nhan), expected: Number(kv.so_khach_du_kien) || 0, showCrest: kv.hien_huy_hieu === '' ? true : bool_(kv.hien_huy_hieu),
    siteUrl: site, livestream: str_(kv.livestream), helperName: str_(kv.nguoi_ho_tro), helperPhone: str_(kv.sdt_ho_tro),
    parents: { trai: { names: str_(kv.nha_trai_bo_me), place: str_(kv.nha_trai_dia_chi) }, gai: { names: str_(kv.nha_gai_bo_me), place: str_(kv.nha_gai_dia_chi) } },
    bank: { trai: bank('trai'), gai: bank('gai') }
  };
}

function readEvents_(cfg) {
  const host = v => { const s = noAccent_(v).toLowerCase(); return s.includes('trai') ? 'trai' : s.includes('gai') ? 'gai' : 'chung'; };
  return table_('NghiLe').rows.filter(r => str_(r.ma)).map(r => ({
    id: str_(r.ma).toLowerCase(), name: str_(r.ten), host: host(str_(r.to_chuc_tai)), date: dateStr_(r.ngay) || cfg.date,
    time: timeStr_(r.gio), place: str_(r.dia_chi), map: str_(r.link_ban_do), note: str_(r.ghi_chu)
  }));
}

function readRoutes_() {
  const out = {};
  table_('LoTrinh').rows.forEach(r => {
    const k = str_(r.ma_noi).toLowerCase();
    out[k] = out[k] || { label: str_(r.ten_noi), steps: [] };
    if (str_(r.tieu_de)) out[k].steps.push([str_(r.tieu_de), str_(r.mo_ta)]);
  });
  return out;
}

function guestOut_(r, full) {
  const g = {
    code: str_(r.ma), name: str_(r.ten_hien_thi), addr: str_(r.cach_goi) || str_(r.ten_hien_thi), side: str_(r.ben) === 'gai' ? 'gai' : 'trai',
    seats: Math.max(1, Number(r.so_ghe) || 1), events: str_(r.nghi_le).toLowerCase().split(/[\s,;]+/).filter(Boolean), from: str_(r.den_tu).toLowerCase(),
    rsvp: str_(r.xac_nhan) ? { status: str_(r.xac_nhan), people: Number(r.so_nguoi) || 0, events: str_(r.nghi_le_du).split(/[\s,;]+/).filter(Boolean), shuttle: bool_(r.can_xe), room: bool_(r.can_phong), note: str_(r.ghi_chu_khach), at: ms_(r.xac_nhan_luc) } : null,
    wish: str_(r.loi_chuc) ? { text: str_(r.loi_chuc), at: ms_(r.loi_chuc_luc) } : null,
    gift: (str_(r.qua_bao_luc) || str_(r.sao_ke_so_tien)) ? { side: str_(r.qua_ben) || str_(r.ben), amount: Number(r.qua_so_tien_bao) || 0, at: ms_(r.qua_bao_luc), selfReported: !!str_(r.qua_bao_luc), matched: !!str_(r.sao_ke_so_tien), matchedAmount: Number(r.sao_ke_so_tien) || 0 } : null
  };
  if (full) Object.assign(g, { views: Number(r.luot_xem) || 0, firstView: ms_(r.xem_lan_dau), lastView: ms_(r.xem_gan_nhat), internalNote: str_(r.ghi_chu_noi_bo) });
  return g;
}

function ensureCodes_() {
  const t = table_('Khach'); let n = 0;
  const used = new Set(t.rows.map(r => str_(r.ma).toLowerCase()).filter(Boolean));
  t.rows.forEach(r => { if (!str_(r.ma) && str_(r.ten_hien_thi)) { const c = newCode_(used); used.add(c); writeRow_(t, r, { ma: c }); n++; } });
  return n;
}
function newCode_(used) {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let c;
  do { c = ''; for (let i = 0; i < 5; i++) c += a[Math.floor(Math.random() * a.length)]; } while (used.has(c));
  return c;
}

/* ============================ HTTP ============================ */

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  try {
    const p = e.parameter || {};
    if (p.action === 'guest') return json_(guestData_(str_(p.code).toLowerCase()));
    if (p.action === 'build') return json_(buildData_(p.key));
    if (p.action === 'ping') return json_({ ok: true });
    return json_({ ok: false, error: 'Không rõ yêu cầu' });
  } catch (err) { return json_({ ok: false, error: String(err && err.message || err) }); }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const b = JSON.parse(e.postData.contents || '{}');
    if (/^admin\./.test(b.action)) return json_(adminAction_(b));
    return json_(guestAction_(b));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally { try { lock.releaseLock(); } catch (x) { } }
}

/* ============================ KHÁCH ============================ */

function findGuest_(code) {
  const t = table_('Khach');
  const r = t.rows.find(x => str_(x.ma).toLowerCase() === code);
  return { t, r };
}

function guestData_(code) {
  if (!/^[a-z0-9]{4,12}$/.test(code)) return { ok: false, error: 'Mã thiệp không hợp lệ' };
  const { t, r } = findGuest_(code);
  if (!r) return { ok: false, error: 'Không tìm thấy thiệp này. Vui lòng kiểm tra lại link.' };
  const cfg = readConfig_(), events = readEvents_(cfg), routes = readRoutes_();
  const g = guestOut_(r, false);
  const wishes = t.rows.filter(x => str_(x.loi_chuc)).map(x => ({ name: str_(x.ten_hien_thi), text: str_(x.loi_chuc), at: ms_(x.loi_chuc_luc) }))
    .sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 200);
  const myEvents = events.filter(ev => g.events.includes(ev.id));
  const route = routes[g.from] || routes[''] || { label: '', steps: [] };
  delete cfg.expected;
  return { ok: true, cfg, events: myEvents, allEventTimes: events.map(ev => ({ date: ev.date, time: ev.time })), route, fromFar: !!(g.from && routes[g.from]), guest: g, wishes };
}

function guestAction_(b) {
  const code = str_(b.code).toLowerCase();
  const { t, r } = findGuest_(code);
  if (!r) return { ok: false, error: 'Không tìm thấy thiệp' };
  const now = new Date();
  const seats = Math.max(1, Number(r.so_ghe) || 1);
  const invited = str_(r.nghi_le).toLowerCase().split(/[\s,;]+/);
  switch (b.action) {
    case 'view':
      writeRow_(t, r, { luot_xem: (Number(r.luot_xem) || 0) + 1, xem_lan_dau: r.xem_lan_dau || now, xem_gan_nhat: now });
      break;
    case 'rsvp': {
      const st = ['yes', 'maybe', 'no'].includes(b.status) ? b.status : 'yes';
      const people = st === 'no' ? 0 : Math.min(seats, Math.max(1, Number(b.people) || 1));
      const evs = st === 'no' ? [] : (b.events || []).map(String).filter(x => invited.includes(x));
      writeRow_(t, r, { xac_nhan: st, so_nguoi: people, nghi_le_du: evs.join(','), can_xe: st !== 'no' && !!b.shuttle, can_phong: st !== 'no' && !!b.room, ghi_chu_khach: str_(b.note).slice(0, 300), xac_nhan_luc: now });
      break;
    }
    case 'wish': {
      const text = str_(b.text).slice(0, 500);
      if (!text) return { ok: false, error: 'Lời chúc trống' };
      writeRow_(t, r, { loi_chuc: text, loi_chuc_luc: now });
      break;
    }
    case 'gift':
      writeRow_(t, r, { qua_ben: b.side === 'gai' ? 'gai' : 'trai', qua_so_tien_bao: Math.max(0, Number(b.amount) || 0), qua_bao_luc: now });
      break;
    default: return { ok: false, error: 'Không rõ thao tác' };
  }
  return { ok: true, guest: guestOut_(r, false) };
}

/* ============================ BUILD (GitHub Actions gọi) ============================ */

function buildData_(key) {
  const real = PropertiesService.getScriptProperties().getProperty('BUILD_KEY');
  if (!real || key !== real) return { ok: false, error: 'Sai BUILD_KEY' };
  ensureCodes_();
  const cfg = readConfig_();
  const guests = table_('Khach').rows.filter(r => str_(r.ma)).map(r => ({ code: str_(r.ma).toLowerCase(), name: str_(r.ten_hien_thi), addr: str_(r.cach_goi) || str_(r.ten_hien_thi) }));
  return { ok: true, cfg: { groom: cfg.groom, bride: cfg.bride, date: cfg.date, siteUrl: cfg.siteUrl }, guests };
}

function triggerRebuild_() {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('GH_TOKEN'), repo = p.getProperty('GH_REPO');
  if (!token || !repo) return { ok: false, error: 'Chưa khai báo GH_TOKEN / GH_REPO, hãy vào tab Actions trên GitHub bấm Run workflow.' };
  const wf = p.getProperty('GH_WORKFLOW') || 'deploy.yml', ref = p.getProperty('GH_BRANCH') || 'main';
  const res = UrlFetchApp.fetch(`https://api.github.com/repos/${repo}/actions/workflows/${wf}/dispatches`, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ ref })
  });
  return res.getResponseCode() === 204 ? { ok: true } : { ok: false, error: 'GitHub từ chối (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 200) };
}

/* ============================ ADMIN ============================ */

function verifyAdmin_(idToken) {
  if (!idToken) throw new Error('Chưa đăng nhập');
  const cache = CacheService.getScriptCache();
  const ck = 'tok_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken));
  let email = cache.get(ck);
  if (!email) {
    const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('Phiên đăng nhập hết hạn, hãy đăng nhập lại');
    const info = JSON.parse(res.getContentText());
    const clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
    if (info.aud !== clientId) throw new Error('Sai GOOGLE_CLIENT_ID');
    if (String(info.email_verified) !== 'true') throw new Error('Gmail chưa xác minh');
    email = String(info.email).toLowerCase();
    cache.put(ck, email, 600);
  }
  const owner = str_(PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL')).toLowerCase();
  if (email === owner) return { email, role: 'owner' };
  const a = table_('Admin').rows.find(r => str_(r.email).toLowerCase() === email);
  if (!a || !ROLES[str_(a.vai_tro)]) throw new Error('Gmail ' + email + ' chưa được cấp quyền. Nhờ chủ thiệp thêm vào tab Admin.');
  return { email, role: ROLES[str_(a.vai_tro)] };
}

function visible_(me, g) { return me.role === 'gai' ? g.side === 'gai' : me.role === 'trai' ? g.side === 'trai' : true; }

function adminAction_(b) {
  const me = verifyAdmin_(b.idToken);
  const canEdit = me.role !== 'view';
  switch (b.action) {
    case 'admin.data': {
      const cfg = readConfig_(), events = readEvents_(cfg), routes = readRoutes_();
      const guests = table_('Khach').rows.filter(r => str_(r.ma)).map(r => guestOut_(r, true)).filter(g => visible_(me, g));
      const out = { ok: true, me, cfg, events, routes: Object.keys(routes).map(k => ({ code: k, label: routes[k].label })), guests };
      if (me.role === 'owner' || me.role === 'full') out.sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
      return out;
    }
    case 'admin.addGuests': {
      if (!canEdit) throw new Error('Vai trò Chỉ xem không thêm khách được');
      const t = table_('Khach'), used = new Set(t.rows.map(r => str_(r.ma).toLowerCase()));
      const evIds = readEvents_(readConfig_()).map(e => e.id), routes = readRoutes_();
      const rows = [], bad = [];
      String(b.lines || '').split('\n').map(s => s.trim()).filter(Boolean).forEach((ln, i) => {
        const c = ln.split('|').map(s => s.trim());
        if (!c[0]) { bad.push(i + 1); return; }
        let side = noAccent_(c[2] || 'trai').toLowerCase().startsWith('g') ? 'gai' : 'trai';
        if (me.role === 'gai' || me.role === 'trai') side = me.role;
        let ev = (c[4] || '').toLowerCase().split(/[\s,;]+/).filter(k => evIds.includes(k));
        if (!ev.length && evIds.length) ev = [evIds[evIds.length - 1]];
        const from = routes[(c[5] || '').toLowerCase()] && c[5] ? c[5].toLowerCase() : '';
        const code = newCode_(used); used.add(code);
        const row = {}; t.headers.forEach(h => row[h] = '');
        Object.assign(row, { ma: code, ten_hien_thi: c[0], cach_goi: c[1] || c[0], ben: side, so_ghe: Math.max(1, parseInt(c[3], 10) || 1), nghi_le: ev.join(','), den_tu: from, ghi_chu_noi_bo: 'Thêm bởi ' + me.email });
        rows.push(t.headers.map(h => row[h]));
      });
      if (rows.length) t.sh.getRange(t.sh.getLastRow() + 1, 1, rows.length, t.headers.length).setValues(rows);
      const rb = rows.length ? triggerRebuild_() : { ok: true };
      return { ok: true, added: rows.length, bad, rebuild: rb };
    }
    case 'admin.match': {
      if (!canEdit) throw new Error('Vai trò Chỉ xem không đối soát được');
      const t = table_('Khach');
      const res = String(b.text || '').split('\n').map(s => s.trim()).filter(Boolean).map(ln => {
        const plain = noAccent_(ln).toUpperCase();
        const m = /MUNG\s*CUOI\s*([A-Z0-9]{5})/.exec(plain);
        const nums = (plain.replace(/MUNG\s*CUOI\s*[A-Z0-9]{5}/, '').match(/\+?\d{1,3}(?:[.,]\d{3})+|\+?\d{4,}/g) || [])
          .map(s => Number(s.replace(/[^\d]/g, ''))).filter(n => n >= 1000 && n < 1e11);
        const amount = nums.length ? Math.max.apply(null, nums) : 0;
        if (!m) return { line: ln, amount, status: 'nocode' };
        const code = m[1].toLowerCase(), r = t.rows.find(x => str_(x.ma).toLowerCase() === code);
        if (!r) return { line: ln, amount, code, status: 'unknown' };
        const g = guestOut_(r, false);
        if (!visible_(me, g)) return { line: ln, amount, code, status: 'other' };
        writeRow_(t, r, { sao_ke_so_tien: amount, sao_ke_noi_dung: ln.slice(0, 200), sao_ke_luc: new Date(), qua_ben: str_(r.qua_ben) || g.side });
        return { line: ln, amount, code, name: g.name, status: 'ok' };
      });
      return { ok: true, results: res };
    }
    case 'admin.rebuild':
      if (me.role !== 'owner' && me.role !== 'full') throw new Error('Chỉ chủ thiệp hoặc quản trị toàn bộ');
      return triggerRebuild_();
    default: throw new Error('Không rõ thao tác');
  }
}

function clientConfig() { // tiện kiểm tra nhanh trong trình soạn thảo
  Logger.log(JSON.stringify(readConfig_(), null, 2));
}
