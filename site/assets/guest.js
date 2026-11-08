/* Thiệp của khách: đọc dữ liệu từ Apps Script (Google Sheet), ghi lượt xem, xác nhận, lời chúc, báo gửi quà. */
(function () {
  const CFG = window.THIEP || {};
  const $ = s => document.querySelector(s);
  const H = 3600e3, D = 24 * H;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BANK_NAMES = { '970436': 'Vietcombank', '970415': 'VietinBank', '970418': 'BIDV', '970405': 'Agribank', '970407': 'Techcombank', '970422': 'MB Bank', '970416': 'ACB', '970432': 'VPBank', '970423': 'TPBank', '970403': 'Sacombank', '970441': 'VIB', '970443': 'SHB', '970437': 'HDBank', '970448': 'OCB', '970440': 'SeABank', '970426': 'MSB' };

  /* ---------- mã khách ---------- */
  const qs = new URLSearchParams(location.search);
  const CODE = (window.GUEST_CODE || qs.get('g') || '').toLowerCase();
  const DEMO = CFG.demo || !CFG.apiUrl || qs.has('demo');

  /* ---------- gọi máy chủ ---------- */
  let demoData = null;
  async function load() {
    if (DEMO) {
      if (!demoData) demoData = await (await fetch(CFG.assetBase + 'demo.json')).json();
      return structuredClone(demoData);
    }
    const r = await fetch(CFG.apiUrl + '?action=guest&code=' + encodeURIComponent(CODE));
    return r.json();
  }
  async function send(action, body) {
    if (DEMO) { // chế độ thử: chỉ cập nhật trên máy
      const g = demoData.guest, now = Date.now();
      if (action === 'rsvp') g.rsvp = Object.assign({}, body, { at: now });
      if (action === 'wish') { g.wish = { text: body.text, at: now }; demoData.wishes = [{ name: g.name, text: body.text, at: now }].concat(demoData.wishes.filter(w => w.name !== g.name)); }
      if (action === 'gift') g.gift = { side: body.side, amount: body.amount, at: now, selfReported: true };
      return { ok: true, guest: structuredClone(g) };
    }
    const r = await fetch(CFG.apiUrl, { method: 'POST', body: JSON.stringify(Object.assign({ action, code: CODE }, body)) });
    return r.json();
  }

  /* ---------- tiện ích ---------- */
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2600); }
  async function copy(text, msg) { try { await navigator.clipboard.writeText(text); toast(msg || 'Đã sao chép'); } catch (e) { toast('Không sao chép được, hãy bấm giữ để chép'); } }
  function ago(t) { if (!t) return ''; const m = Math.round((Date.now() - t) / 6e4); if (m < 60) return Math.max(0, m) + ' phút trước'; const h = Math.round(m / 60); if (h < 24) return h + ' giờ trước'; return Math.round(h / 24) + ' ngày trước'; }
  const WD = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  function parseD(d) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; }
  function wd(d) { const p = parseD(d); return p ? WD[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()] : ''; }
  function dmy(d) { const p = parseD(d); return p ? `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}` : ''; }
  function evTime(e) { const p = parseD(e.date); if (!p) return null; const [h, mi] = (e.time || '00:00').split(':').map(Number); return Date.UTC(p.y, p.m - 1, p.d, (h || 0) - 7, mi || 0); }
  function gcal(t) { return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function hostLabel(h) { return { trai: 'tư gia nhà trai', gai: 'tư gia nhà gái' }[h] || ''; }
  function mapLink(e) { return e.map && /^https?:\/\//.test(e.map) ? e.map : 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(e.place || ''); }
  const giftMemo = c => ('MUNG CUOI ' + c).toUpperCase();

  /* ---------- VietQR (chuẩn EMVCo/NAPAS) ---------- */
  function tlv(id, v) { return id + String(v.length).padStart(2, '0') + v; }
  function crc16(s) { let c = 0xFFFF; for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) { c = (c & 0x8000) ? ((c << 1) ^ 0x1021) : (c << 1); c &= 0xFFFF; } } return c.toString(16).toUpperCase().padStart(4, '0'); }
  function vietqr({ bin, acc, memo }) {
    const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', acc)) + tlv('02', 'QRIBFTTA');
    const p = tlv('00', '01') + tlv('01', '11') + tlv('38', merchant) + tlv('53', '704') + tlv('58', 'VN') + (memo ? tlv('62', tlv('08', memo)) : '') + '6304';
    return p + crc16(p);
  }

  /* ---------- huy hiệu & đường lượn vàng ---------- */
  function goldDefs(id) {
    return `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="520" y2="0" spreadMethod="reflect">
      <stop offset="0" stop-color="#b8863a"/><stop offset=".35" stop-color="#f7e3a6"/><stop offset=".5" stop-color="#fff4cf"/><stop offset=".65" stop-color="#e9c46f"/><stop offset="1" stop-color="#b8863a"/>
      ${still ? '' : '<animate attributeName="x1" values="-520;520" dur="7s" repeatCount="indefinite"/><animate attributeName="x2" values="0;1040" dur="7s" repeatCount="indefinite"/>'}</linearGradient></defs>`;
  }
  const CREST = "<circle cx=\"260\" cy=\"124\" r=\"74\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"1.6\"/><circle cx=\"260\" cy=\"124\" r=\"68\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\".8\"/><text x=\"260\" y=\"146\" text-anchor=\"middle\" font-size=\"64\" fill=\"url(#GID)\" style=\"font-family:serif\">囍</text><path d=\"M327.9 56.1 L329.8 58.1 L331.6 60.0 L333.4 62.1 L335.1 64.2 L336.7 66.3 L338.3 68.5 L339.9 70.7 L341.3 73.0 L342.7 75.3 L344.1 77.6 L345.3 80.0 L346.5 82.4 L347.7 84.9 L348.7 87.4 L349.7 89.9 L350.7 92.4 L351.5 95.0 L352.3 97.6 L353.0 100.2 L353.6 102.8 L354.2 105.5 L354.7 108.1 L355.1 110.8 L355.4 113.5 L355.7 116.2 L355.9 118.9 L356.0 121.5 L356.0 124.3 L356.0 127.0 L355.8 129.7 L355.6 132.3 L355.4 135.0 L355.0 137.7 L354.6 140.4 L354.1 143.0 L353.5 145.7 L352.9 148.3 L352.2 150.9 L351.4 153.5 L350.5 156.0 L349.6 158.6 L348.5 161.1 L347.5 163.6 L346.3 166.0 L345.1 168.4 L343.8 170.8 L342.5 173.1 L341.1 175.4 L339.6 177.7 L338.0 179.9 L336.4 182.1 L334.8 184.2 L333.0 186.3 L331.3 188.3 L329.4 190.3 L327.5 192.2 L325.6 194.1 L323.6 195.9 L321.5 197.7 L319.4 199.4 L317.3 201.0 L315.1 202.6 L312.9 204.1 L310.6 205.6 L308.3 207.0 L305.9 208.3 L303.5 209.6 L301.1 210.8 L298.6 211.9 L296.2 212.9 L293.6 213.9 L291.1 214.8 L288.5 215.7 L285.9 216.4 L283.3 217.1 L280.7 217.7 L278.1 218.3 L275.4 218.8 L272.7 219.2 L270.0 219.5\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"5\" stroke-linecap=\"round\"/><path d=\"M327.9 56.1 L329.8 58.1 L331.6 60.0 L333.4 62.1 L335.1 64.2 L336.7 66.3 L338.3 68.5 L339.9 70.7 L341.3 73.0 L342.7 75.3 L344.1 77.6 L345.3 80.0 L346.5 82.4 L347.7 84.9 L348.7 87.4 L349.7 89.9 L350.7 92.4 L351.5 95.0 L352.3 97.6 L353.0 100.2 L353.6 102.8 L354.2 105.5 L354.7 108.1 L355.1 110.8 L355.4 113.5 L355.7 116.2 L355.9 118.9 L356.0 121.5 L356.0 124.3 L356.0 127.0 L355.8 129.7 L355.6 132.3 L355.4 135.0 L355.0 137.7 L354.6 140.4 L354.1 143.0 L353.5 145.7 L352.9 148.3 L352.2 150.9 L351.4 153.5 L350.5 156.0 L349.6 158.6 L348.5 161.1 L347.5 163.6 L346.3 166.0 L345.1 168.4 L343.8 170.8 L342.5 173.1 L341.1 175.4 L339.6 177.7 L338.0 179.9 L336.4 182.1 L334.8 184.2 L333.0 186.3 L331.3 188.3 L329.4 190.3 L327.5 192.2 L325.6 194.1 L323.6 195.9 L321.5 197.7 L319.4 199.4 L317.3 201.0 L315.1 202.6 L312.9 204.1 L310.6 205.6 L308.3 207.0 L305.9 208.3 L303.5 209.6 L301.1 210.8 L298.6 211.9 L296.2 212.9 L293.6 213.9 L291.1 214.8 L288.5 215.7 L285.9 216.4 L283.3 217.1 L280.7 217.7 L278.1 218.3 L275.4 218.8 L272.7 219.2 L270.0 219.5\" fill=\"none\" stroke=\"#6b1218\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><g fill=\"none\" stroke=\"url(#GID)\" stroke-linecap=\"round\"><path d=\"M250.0 219.0 L247.9 218.5 L245.8 218.0 L243.7 217.6 L241.6 217.0 L239.5 216.5 L237.4 215.9 L235.4 215.2 L233.4 214.5 L231.4 213.8 L229.4 213.0 L227.4 212.2 L225.4 211.3 L223.5 210.4 L221.6 209.5 L219.7 208.5 L217.8 207.4 L216.0 206.4 L214.2 205.3 L212.4 204.1 L210.7 202.9 L208.9 201.7 L207.2 200.5 L205.6 199.2 L203.9 197.8 L202.3 196.5 L200.8 195.1 L199.2 193.7 L197.7 192.2 L196.3 190.7 L194.8 189.2 L193.4 187.6 L192.1 186.0 L190.7 184.4 L189.5 182.8 L188.2 181.1 L187.0 179.4 L185.8 177.7 L184.7 175.9 L183.6 174.2 L182.6 172.4 L181.6 170.6 L180.6 168.7 L179.7 166.9 L178.8 165.0 L178.0 163.1 L177.2 161.2 L176.4 159.3 L175.7 157.4 L175.1 155.4 L174.4 153.5 L173.9 151.5 L173.3 149.5 L172.9 147.5 L172.4 145.5 L172.0 143.5 L171.7 141.5 L171.4 139.5 L171.2 137.4 L171.0 135.4 L170.8 133.4 L170.6 131.3 L170.5 129.3 L170.4 127.3 L170.3 125.3 L170.3 123.2 L170.3 121.2 L170.4 119.1 L170.6 117.1 L170.7 115.1 L171.0 113.1 L171.2 111.1 L171.6 109.0 L171.9 107.0 L172.3 105.0 L172.8 103.1 L173.3 101.1 L173.8 99.1 L174.4 97.2 L175.0 95.2 L175.7 93.3 L176.4 91.4 L177.2 89.5 L178.0 87.7 L178.8 85.8 L179.7 84.0 L180.7 82.2 L181.6 80.4 L182.6 78.6 L183.7 76.9 L184.8 75.1 L185.9 73.5 L187.1 71.8 L188.3 70.1 L189.5 68.5 L190.8 66.9 L192.1 65.4 L193.4 63.9 L194.8 62.4 L196.2 60.9 L197.7 59.5 L199.2 58.1 L200.7 56.7 L202.2 55.3 L203.7 53.9 L205.2 52.6 L206.8 51.3 L208.4 50.0 L210.0 48.8 L211.7 47.6 L213.4 46.4 L215.1 45.3 L216.9 44.2 L218.6 43.2 L220.4 42.2 L222.3 41.2 L224.1 40.3 L226.0 39.4 L227.9 38.5 L229.8 37.7 L231.8 37.0 L228.9 28.4 L226.8 29.1 L224.6 29.7 L222.4 30.5 L220.3 31.3 L218.1 32.1 L216.0 33.0 L213.9 33.9 L211.8 34.9 L209.8 35.9 L207.7 37.0 L205.7 38.1 L203.7 39.3 L201.8 40.5 L199.8 41.8 L197.9 43.1 L196.0 44.4 L194.2 45.8 L192.3 47.3 L190.6 48.8 L188.9 50.4 L187.3 52.0 L185.7 53.7 L184.1 55.4 L182.6 57.2 L181.1 58.9 L179.6 60.7 L178.2 62.6 L176.8 64.4 L175.5 66.4 L174.2 68.3 L173.0 70.2 L171.8 72.2 L170.6 74.2 L169.5 76.3 L168.4 78.4 L167.4 80.4 L166.5 82.6 L165.6 84.7 L164.7 86.8 L163.9 89.0 L163.1 91.2 L162.4 93.4 L161.7 95.6 L161.1 97.9 L160.5 100.1 L160.0 102.4 L159.5 104.7 L159.1 106.9 L158.8 109.2 L158.5 111.5 L158.2 113.8 L158.0 116.2 L157.8 118.5 L157.8 120.8 L157.7 123.1 L157.7 125.4 L157.8 127.7 L157.9 130.1 L158.0 132.4 L158.3 134.7 L158.6 137.0 L159.0 139.3 L159.5 141.5 L160.0 143.8 L160.5 146.1 L161.1 148.3 L161.8 150.5 L162.5 152.7 L163.2 154.9 L164.0 157.0 L164.9 159.2 L165.8 161.3 L166.7 163.4 L167.7 165.5 L168.7 167.5 L169.8 169.6 L171.0 171.5 L172.1 173.5 L173.3 175.5 L174.6 177.4 L175.9 179.2 L177.3 181.1 L178.6 182.9 L180.1 184.7 L181.5 186.4 L183.0 188.1 L184.6 189.8 L186.1 191.4 L187.8 193.0 L189.4 194.6 L191.1 196.1 L192.8 197.6 L194.6 199.0 L196.3 200.4 L198.1 201.8 L200.0 203.1 L201.8 204.4 L203.7 205.6 L205.6 206.7 L207.6 207.9 L209.6 209.0 L211.5 210.0 L213.6 211.0 L215.6 211.9 L217.6 212.8 L219.7 213.7 L221.8 214.5 L223.9 215.2 L226.0 215.9 L228.1 216.6 L230.3 217.1 L232.4 217.7 L234.6 218.2 L236.8 218.6 L238.9 219.0 L241.1 219.3 L243.3 219.6 L245.5 219.8 L247.7 219.9 L249.9 220.0 Z\" fill=\"#6b1218\" stroke-width=\"1.4\"/><path d=\"M215.0 206.6L212.0 207.2L213.1 210.0 M204.7 199.6L201.0 199.8L201.8 203.4 M195.4 191.3L191.1 190.9L191.5 195.2 M187.4 181.9L182.6 180.8L182.4 185.7 M180.6 171.5L175.5 169.6L174.5 175.0 M175.3 160.4L170.0 157.5L168.2 163.3 M171.5 148.8L166.3 144.9L163.4 150.8 M169.4 136.7L164.3 131.8L160.3 137.7 M168.5 124.3L164.1 118.7L159.4 124.0 M169.3 111.9L165.7 105.8L160.3 110.4 M171.8 99.7L169.1 93.1L163.1 97.0 M175.9 87.9L174.1 81.1L167.7 84.1 M181.6 76.8L180.7 69.8L174.0 71.9 M188.7 66.6L188.8 59.6L181.8 60.7 M197.1 57.5L198.2 50.5L191.1 50.7 M206.8 49.0L208.6 42.9L202.2 42.2\" stroke-width=\".9\"/></g><g transform=\"translate(230.3,32.7) rotate(-18.7) scale(0.9)\" fill=\"none\" stroke=\"url(#GID)\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M-5 -6 C3 -12 18 -10 27 0 C18 10 3 12 -5 6 C-2 2 -2 -2 -5 -6 Z\" fill=\"#6b1218\" stroke-width=\"1.6\"/><path d=\"M8 -5 C12 -7 18 -6 21 -2\" stroke-width=\"1\"/><circle cx=\"16\" cy=\"-2.6\" r=\"1.8\" fill=\"url(#GID)\" stroke=\"none\"/><path d=\"M27 0 L37 0 M37 0 L42 -3.5 M37 0 L42 3.5\" stroke-width=\"1.2\"/></g><path d=\"M252 222 c4 6 12 6 16 0 c-4 -6 -12 -6 -16 0z\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"1.4\"/><g transform=\"translate(266,-2) scale(.85)\"><g fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n<path d=\"M62 40 C56 36 46 38 38 44 C32 48 28 54 30 58 C32 61 38 60 42 58 C46 58 50 58 52 58\"/>\n<path d=\"M60 38 C62 22 76 12 92 14 C100 15 104 22 100 28\"/><path d=\"M65 41 C69 27 82 19 96 23\" stroke-width=\"1.4\"/>\n<path d=\"M64 46 C72 46 80 50 84 54 C76 54 70 52 64 50\"/>\n<path d=\"M45 46 q3.5 -2.4 7 0 q-3.5 2 -7 0\" stroke-width=\"1.4\"/>\n<path d=\"M36 60 C34 68 36 76 40 84 C40 75 42 67 44 60\"/>\n<path d=\"M62 40 C70 52 76 62 80 76\"/><path d=\"M52 58 C56 70 58 80 58 90\"/>\n<path d=\"M58 90 C64 86 74 84 80 76\" stroke-width=\"1.4\"/></g></g>";
  /* Long Phụng: rồng (nhà trai) bên trái, phượng (nhà gái) bên phải, chầu ngọc trên chữ 囍. Sinh bằng script, nét vàng cùng kiểu huy hiệu cũ. */
  const LONG_PHUNG = "<circle cx=\"260\" cy=\"150\" r=\"66\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"1.6\"/><circle cx=\"260\" cy=\"150\" r=\"60\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\".7\"/><g transform=\"translate(224,114) scale(.72)\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"6\" stroke-linecap=\"square\" stroke-linejoin=\"miter\"><path d=\"M8 10H92 M25 2V22 M75 2V22 M14 22H36 M64 22H86 M36 22H64 M13 30h24v13h-24z M63 30h24v13h-24z M18 49l3 6 M32 49l-3 6 M68 49l3 6 M82 49l-3 6 M4 60H96 M13 68h24v26h-24z M63 68h24v26h-24z\"/></g><g fill=\"none\" stroke=\"url(#GID)\" stroke-linecap=\"round\"><circle cx=\"260\" cy=\"30\" r=\"8\" fill=\"url(#GID)\" stroke=\"none\"/><circle cx=\"260\" cy=\"30\" r=\"12\" stroke-width=\"1\"/>\n<path d=\"M248 26 c-6 -6 -2 -14 4 -16 M272 26 c6 -6 2 -14 -4 -16 M260 18 c-3 -6 0 -11 4 -13 M251 39 c-5 3 -9 2 -11 -1 M269 39 c5 3 9 2 11 -1\" stroke-width=\"1.2\"/></g><path d=\"M215.6 61.4 L213.6 61.5 L211.5 61.6 L209.4 61.8 L207.3 62 L205.1 62.3 L202.9 62.7 L200.8 63.1 L198.6 63.7 L196.3 63.8 L194.2 64.8 L192.2 65.7 L190.1 66.8 L188.2 68 L186.2 69.2 L184.3 70.5 L182.5 71.9 L180.7 73.4 L179 75 L177.4 76.6 L175.9 78.3 L174.4 80.1 L173 81.9 L171.7 83.8 L170.5 85.7 L169.3 87.7 L168.3 89.7 L167.3 91.8 L166.4 93.9 L165.7 96 L165 98.1 L164.4 100.3 L163.9 102.5 L163.4 104.6 L163.1 106.8 L162.8 109 L162.6 111.2 L162.4 113.3 L162.4 115.5 L162.4 117.6 L162.4 119.7 L162.5 121.8 L162.7 123.9 L162.9 125.9 L163.1 127.9 L163.4 129.9 L163.7 131.8 L164.1 133.7 L164.4 135.6 L164.8 137.5 L165.2 139.3 L165.6 141.1 L166 142.8 L166.4 144.5 L166.8 146.2 L167.2 147.9 L167.6 149.5 L168 151.1 L168.4 152.7 L168.8 154.3 L169.1 155.8 L169.5 157.4 L169.8 158.9 L170.2 160.4 L170.5 162 L170.8 163.5 L171 165 L171.3 166.5 L171.6 168.1 L171.8 169.6 L172.1 171.2 L172.3 172.8 L172.5 174.4 L172.7 176 L173 177.6 L173.2 179.3 L173.4 181 L173.7 182.7 L173.9 184.4 L174.2 186.2 L174.5 188 L174.8 189.8 L175.1 191.6 L175.5 193.4 L175.9 195.3 L176.3 197.1 L176.8 199 L177.3 200.9 L177.8 202.8 L178.4 204.6 L179.1 206.5 L179.8 208.4 L180.5 210.3 L181.3 212.1 L182.2 213.9 L183.2 215.7 L184.1 217.5 L185.2 219.3 L186.3 221 L187.5 222.7 L188.7 224.3 L190 225.9 L191.4 227.4 L192.8 228.9 L194.3 230.3 L195.8 231.7 L197.4 233 L199 234.3 L200.7 235.4 L202.4 236.5 L204.1 237.6 L205.9 238.5 L207.8 239.4 L209.6 240.2 L211.5 241 L213.4 241.6 L215.3 242.2 L217.3 242.8 L219.2 243.2 L221.2 243.6 L223.2 243.9 L225.1 244.1 L227.1 244.3 L229.1 244.4 L231 244.5 L233 244.5 L234.9 244.4 L236.8 244.3 L238.8 244.2 L240.6 244 L242.5 243.7 L244.4 243.4 L246.2 243.1 L248 242.8 L249.8 242.4 L251.6 242 L253.4 241.5 L255.1 241.1 L256.8 240.6 L258.5 240.1 L260.1 239.5 L259.9 238.3 L258.1 238.5 L256.4 238.7 L254.7 239 L252.9 239.2 L251.2 239.4 L249.4 239.6 L247.6 239.8 L245.8 240 L244 240.1 L242.2 240.2 L240.4 240.3 L238.6 240.3 L236.7 240.3 L234.9 240.2 L233.1 240.1 L231.3 240 L229.4 239.8 L227.6 239.5 L225.8 239.2 L224.1 238.9 L222.3 238.5 L220.5 238 L218.8 237.4 L217.1 236.9 L215.4 236.2 L213.8 235.5 L212.1 234.7 L210.6 233.9 L209 233 L207.5 232 L206 231 L204.6 230 L203.2 228.9 L201.9 227.7 L200.6 226.5 L199.4 225.2 L198.2 223.9 L197.1 222.5 L196 221.1 L195 219.7 L194 218.2 L193.1 216.7 L192.2 215.2 L191.4 213.6 L190.6 212 L189.9 210.4 L189.3 208.8 L188.6 207.1 L188.1 205.4 L187.6 203.7 L187.1 202 L186.7 200.3 L186.3 198.6 L185.9 196.9 L185.6 195.2 L185.3 193.5 L185.1 191.8 L184.8 190.1 L184.6 188.3 L184.5 186.6 L184.3 184.9 L184.2 183.2 L184 181.6 L183.9 179.9 L183.8 178.2 L183.6 176.5 L183.5 174.9 L183.4 173.2 L183.3 171.6 L183.2 169.9 L183 168.3 L182.9 166.6 L182.7 165 L182.5 163.3 L182.3 161.7 L182.1 160 L181.9 158.4 L181.7 156.8 L181.4 155.1 L181.1 153.5 L180.9 151.8 L180.6 150.2 L180.3 148.5 L180 146.9 L179.7 145.2 L179.4 143.5 L179.1 141.9 L178.8 140.2 L178.5 138.5 L178.2 136.8 L177.9 135.1 L177.7 133.4 L177.4 131.6 L177.2 129.9 L177 128.2 L176.9 126.5 L176.8 124.7 L176.7 123 L176.6 121.2 L176.6 119.5 L176.7 117.8 L176.8 116 L176.9 114.3 L177.1 112.6 L177.4 110.9 L177.7 109.3 L178 107.6 L178.4 106 L178.9 104.4 L179.4 102.8 L180 101.3 L180.6 99.8 L181.3 98.3 L182.1 96.9 L182.9 95.5 L183.8 94.1 L184.7 92.8 L185.7 91.5 L186.7 90.3 L187.8 89.2 L188.9 88.1 L190.1 87 L191.3 86 L192.6 85 L193.9 84.1 L195.2 83.3 L196.6 82.5 L198.1 81.7 L199.5 81 L201 80.4 L202.6 79.8 L203.9 78.6 L205.4 77.9 L207 77.3 L208.6 76.7 L210.2 76.1 L211.9 75.6 L213.6 75.1 L215.3 74.7 L217.1 74.3 Z\" fill=\"#6b1218\" stroke=\"url(#GID)\" stroke-width=\"1.5\" stroke-linejoin=\"round\"/><path d=\"M199.3 65.5 Q206.3 69.4 203.2 76.7 M191.1 68.7 Q199.1 71.6 197.1 79.8 M183.8 73.6 Q192 75.1 191.3 83.4 M177.4 79.7 Q185.5 79.7 186.3 87.8 M172.1 86.8 Q180 85.4 182.1 93.1 M168.2 94.6 Q175.5 92 178.9 99 M165.7 102.9 Q172.3 99.3 176.6 105.5 M164.4 111.3 Q170.3 107 175.3 112.4 M164.2 119.7 Q169.5 114.8 174.9 119.5 M164.9 127.7 Q169.5 122.5 175.2 126.6 M166.1 135.3 Q170.3 130 176 133.7 M167.6 142.5 Q171.5 137.2 177.2 140.5 M169.2 149.2 Q172.9 144 178.4 147.2 M170.6 155.5 Q174.3 150.6 179.6 153.8 M171.9 161.7 Q175.6 157.1 180.7 160.3 M173 167.9 Q176.7 163.5 181.4 166.8 M173.9 174.2 Q177.6 170.1 182 173.4 M174.7 180.9 Q178.3 176.9 182.6 180 M175.7 187.8 Q179 183.9 183.2 186.8 M177.1 195 Q180 191.2 184.1 193.7 M178.9 202.5 Q181.4 198.6 185.6 200.6 M181.5 209.9 Q183.5 205.9 187.6 207.5 M185 217 Q186.4 213.1 190.5 214.1 M189.5 223.7 Q190.3 219.9 194.2 220.3 M194.9 229.7 Q195.1 226.1 198.7 225.8 M201.2 234.8 Q200.8 231.4 204.1 230.7 M208.1 238.7 Q207.3 235.7 210.2 234.6 M215.6 241.6 Q214.4 239 216.9 237.5 M223.3 243.3 Q221.9 241.1 223.9 239.5 M231.1 243.9 Q229.6 242.2 231.2 240.6 M238.7 243.7 Q237.4 242.3 238.6 240.8\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\".8\"/><path d=\"M202.9 62.7 Q202 53.4 202 53.4 Q193.9 63.8 194.2 64.8 M188.2 68 Q184.6 58.7 184.6 58.7 Q180.2 72.6 180.7 73.4 M175.9 78.3 Q169.8 70.8 169.8 70.8 Q169.7 85.1 170.5 85.7 M167.3 91.8 Q159.6 86.6 159.6 86.6 Q163.4 99.9 164.4 100.3 M163.1 106.8 Q154.6 103.8 154.6 103.8 Q161.4 115.4 162.4 115.5 M162.5 121.8 Q154 120.4 154 120.4 Q162.4 130 163.4 129.9 M164.4 135.6 Q156.1 135 156.1 135 Q165 143 166 142.8 M167.2 147.9 Q159.3 147.3 159.3 147.3 Q167.8 154.5 168.8 154.3 M169.8 158.9 Q162.3 158 162.3 158 Q170.1 165.2 171 165 M171.8 169.6 Q164.6 168.4 164.6 168.4 Q171.8 176.1 172.7 176 M173.4 181 Q166.6 180.1 166.6 180.1 Q173.5 188.1 174.5 188 M175.5 193.4 Q169 193.5 169 193.5 Q176.3 201.1 177.3 200.9 M179.1 206.5 Q173.1 207.8 173.1 207.8 Q181.3 214.3 182.2 213.9 M185.2 219.3 Q180.1 221.8 180.1 221.8 Q189.2 226.5 190 225.9 M194.3 230.3 Q190.4 234 190.4 234 Q200 236.2 200.7 235.4 M205.9 238.5 Q203.5 242.8 203.5 242.8 Q213 242.6 213.4 241.6 M219.2 243.2 Q218.2 247.6 218.2 247.6 Q226.9 245.3 227.1 244.3 M233 244.5 Q233 248.4 233 248.4 Q240.7 245 240.6 244\" fill=\"url(#GID)\" stroke=\"url(#GID)\" stroke-width=\".6\" stroke-linejoin=\"round\"/><path d=\"M175.5 83.8 Q172 73.6 164.8 78.1\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M164.8 78.1 Q163.4 81.3 160 81.7 M164.8 78.1 Q162.9 80.3 159 79.9 M164.8 78.1 Q162.7 79.5 158.8 78.5\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"1.2\" stroke-linecap=\"round\"/><path d=\"M176.5 101.9 Q186.9 98.9 187.3 107.5\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M187.3 107.5 Q185.5 110.4 187.1 113.5 M187.3 107.5 Q186.7 110.3 189.1 113.2 M187.3 107.5 Q187.4 109.9 190.4 112.6\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"1.2\" stroke-linecap=\"round\"/><path d=\"M174.7 174.1 Q165.1 169.1 163 177.4\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M163 177.4 Q164.2 180.7 162 183.3 M163 177.4 Q163.1 180.3 160 182.6 M163 177.4 Q162.4 179.8 158.9 181.8\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"1.2\" stroke-linecap=\"round\"/><path d=\"M182.5 186.9 Q190.6 179.8 194.6 187.3\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M194.6 187.3 Q194.2 190.7 197 192.8 M194.6 187.3 Q195.2 190.1 198.7 191.7 M194.6 187.3 Q195.8 189.5 199.6 190.6\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"1.2\" stroke-linecap=\"round\"/><path d=\"M260 238.9 Q263.8 228.8 270.1 229.4 q0.2 1 0.1 1.4 M260 238.9 Q265.8 237.5 271.7 236.2 q-0.4 -1.9 -0.1 -2.7 M260 238.9 Q267.9 246.3 273.3 243 q-1.1 -4.9 -0.3 -6.8\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"1.1\" stroke-linecap=\"round\"/><g transform=\"translate(216.3,67.9) rotate(-47.1) scale(1.35)\" fill=\"none\" stroke=\"url(#GID)\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n<path d=\"M-4 -8 C-12 -14 -18 -22 -26 -22 M-2 -6 C-12 -10 -20 -12 -28 -10 M-2 6 L-10 10 L-4 3 L-14 4 L-4 0 L-12 -3 L-4 -4\" stroke-width=\"1\" fill=\"none\"/>\n<path d=\"M-2 -8 C6 -12 14 -12 20 -9 C24 -8 28 -10 31 -7 C33 -4 30 -1 26 -1 L16 0 L26 3 C29 4 29 8 25 9 C16 11 6 10 -2 8 Z\" fill=\"#6b1218\" stroke-width=\"1.5\"/>\n<path d=\"M16 0 L10 0\" stroke-width=\"1\"/><path d=\"M19 1.3 l1 2.2 M23 1.6 l1 2\" stroke-width=\".8\"/>\n<path d=\"M8 -6 q4 -3 7 0 q-3.5 2.2 -7 0\" stroke-width=\"1.1\"/><circle cx=\"11.5\" cy=\"-5.8\" r=\"1.2\" fill=\"url(#GID)\" stroke=\"none\"/>\n<path d=\"M4 -11 C2 -18 -6 -24 -14 -26 C-10 -22 -6 -18 -4 -12\" fill=\"url(#GID)\" stroke-width=\".8\"/>\n<path d=\"M30 -8 C36 -12 42 -10 42 -4 C42 0 38 1 37 -2\" stroke-width=\"1\"/>\n<path d=\"M24 9 C30 16 40 16 44 10 C46 7 43 5 41 7\" stroke-width=\"1\"/>\n<path d=\"M4 9 C2 14 -2 16 -6 16\" stroke-width=\".9\"/></g><path d=\"M316.6 77.5 L319 78.8 L321.4 80.2 L323.8 81.7 L326.1 83.2 L328.3 84.9 L330.5 86.7 L332.6 88.5 L334.6 90.4 L336.6 92.4 L338.5 94.5 L340.3 96.7 L342 99 L343.5 101.3 L345 103.8 L346.3 106.2 L347.6 108.8 L348.7 111.4 L349.7 114 L350.5 116.7 L351.2 119.5 L351.8 122.2 L352.3 125 L352.6 127.8 L352.8 130.6 L352.9 133.4 L352.9 136.2 L352.7 139 L352.4 141.8 L352 144.5 L351.6 147.2 L351 149.9 L350.3 152.5 L349.6 155.1 L348.7 157.7 L347.8 160.2 L346.9 162.7 L345.9 165.1 L344.8 167.5 L343.7 169.8 L342.6 172.1 L341.4 174.4 L340.2 176.6 L339 178.8 L337.7 180.9 L336.4 183 L335.2 185.1 L333.9 187.2 L332.6 189.2 L331.3 191.3 L329.9 193.3 L328.6 195.3 L327.3 197.3 L325.9 199.2 L324.5 201.2 L323.1 203.2 L321.7 205.1 L320.2 207.1 L318.7 209 L317.2 211 L315.6 212.9 L314 214.8 L312.4 216.7 L310.7 218.5 L308.9 220.4 L307.1 222.2 L305.2 223.9 L303.3 225.7 L301.3 227.3 L299.2 228.9 L297.1 230.5 L294.9 231.9 L292.7 233.3 L290.3 234.6 L288 235.8 L285.5 236.9 L283.1 237.9 L280.6 238.8 L278 239.6 L275.4 240.3 L272.8 240.8\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"2.6\" stroke-linecap=\"round\"/><path d=\"M338.5 94.5 Q335.5 97.1 330 94.8 M347.6 108.8 Q344.1 110.4 339.6 106.8 M352.3 125 Q348.6 125.5 345.5 121 M352.4 141.8 Q348.9 141.3 347.1 136.3 M348.7 157.7 Q345.5 156.6 344.8 151.5 M342.6 172.1 Q339.6 170.6 339.6 165.7 M335.2 185.1 Q332.5 183.5 332.9 178.7 M327.3 197.3 Q324.7 195.6 325.4 191.1 M318.7 209 Q316.4 207.3 317.3 203 M308.9 220.4 Q306.9 218.4 308.2 214.5 M297.1 230.5 Q295.6 228.3 297.5 224.8\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\".6\" stroke-linecap=\"round\"/><g fill=\"none\" stroke=\"url(#GID)\"><path d=\"M272.8 240.8 Q266.5 235 261 243.2 Q269.3 248.7 272.8 240.8\" fill=\"#6b1218\" stroke-width=\"1.1\"/><circle cx=\"265.9\" cy=\"242.2\" r=\"1.8\" fill=\"url(#GID)\" stroke=\"none\"/></g><path d=\"M324.2 78.7 L326.3 79.8 L328.4 81 L330.4 82.3 L332.4 83.6 L334.4 85 L336.3 86.5 L338.2 88.1 L340 89.7 L341.8 91.4 L343.5 93.1 L345.2 95 L346.7 96.8 L348.2 98.8 L349.6 100.8 L351 102.9 L352.2 105 L353.4 107.2 L354.4 109.4 L355.4 111.7 L356.2 114 L357 116.4 L357.7 118.7 L358.3 121.1 L358.8 123.5 L359.2 126 L359.5 128.4 L359.7 130.8 L359.8 133.3 L359.9 135.7 L359.8 138.2 L359.8 140.6 L359.6 143 L359.4 145.4 L359.1 147.8 L358.7 150.2 L358.3 152.6 L357.9 154.9 L357.4 157.2 L356.9 159.5 L356.3 161.8 L355.8 164.1 L355.2 166.4 L354.5 168.6 L353.9 170.8 L353.2 173 L352.6 175.2 L351.9 177.4 L351.2 179.6 L350.5 181.8 L349.8 184 L349 186.2 L348.3 188.4 L347.5 190.6 L346.8 192.8 L346 195 L345.2 197.2 L344.3 199.4 L343.5 201.7 L342.6 203.9 L341.6 206.1 L340.7 208.3 L339.7 210.6 L338.6 212.8 L337.5 215 L336.3 217.2 L335.1 219.4 L333.8 221.6 L332.5 223.8 L331.1 225.9 L329.6 228 L328.1 230.1 L326.5 232.1 L324.8 234 L323 236 L321.2 237.8 L319.3 239.6 L317.3 241.3 L315.3 243 L313.2 244.5 L311.1 246\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><path d=\"M343.5 93.1 Q340.6 95.8 335.1 93.8 M352.2 105 Q348.8 106.9 344.1 103.7 M357.7 118.7 Q354.1 119.7 350.5 115.5 M359.8 133.3 Q356.2 133.4 353.7 128.8 M359.1 147.8 Q355.6 147.4 354 142.5 M356.3 161.8 Q353.1 161 352 156.2 M352.6 175.2 Q349.5 174.3 348.8 169.6 M348.3 188.4 Q345.4 187.4 344.8 182.9 M343.5 201.7 Q340.8 200.6 340.4 196.3 M337.5 215 Q335 213.8 335.1 209.6 M329.6 228 Q327.5 226.4 328.1 222.6\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\".6\" stroke-linecap=\"round\"/><g fill=\"none\" stroke=\"url(#GID)\"><path d=\"M311.1 246 Q303 243.1 301.2 252.8 Q310.9 254.6 311.1 246\" fill=\"#6b1218\" stroke-width=\"1.1\"/><circle cx=\"305.3\" cy=\"250\" r=\"1.8\" fill=\"url(#GID)\" stroke=\"none\"/></g><path d=\"M317.9 81.1 L320.2 82.8 L322.5 84.7 L324.8 86.6 L326.9 88.7 L329 90.8 L331 93 L333 95.3 L334.8 97.6 L336.6 100 L338.2 102.5 L339.8 105.1 L341.2 107.7 L342.5 110.4 L343.7 113.2 L344.8 116 L345.7 118.8 L346.5 121.7 L347.2 124.6 L347.7 127.5 L348.2 130.5 L348.5 133.4 L348.6 136.4 L348.6 139.3 L348.5 142.3 L348.3 145.2 L348 148.1 L347.5 151 L346.9 153.8 L346.3 156.6 L345.5 159.4 L344.6 162.1 L343.6 164.7 L342.5 167.4 L341.4 169.9 L340.2 172.4 L338.9 174.9 L337.5 177.3 L336.1 179.6 L334.6 181.9 L333.1 184.1 L331.5 186.2 L329.9 188.4 L328.3 190.4 L326.6 192.4 L324.8 194.4 L323.1 196.3 L321.3 198.1 L319.5 199.9 L317.7 201.7 L315.8 203.4 L313.9 205.1 L312 206.7 L310.1 208.4 L308.1 209.9 L306.1 211.4 L304.1 212.9 L302 214.4 L299.9 215.8 L297.8 217.1 L295.6 218.4 L293.4 219.7 L291.2 220.9 L288.9 222 L286.6 223.1 L284.3 224.1 L281.9 225.1 L279.5 225.9 L277 226.7 L274.5 227.4 L272 228.1 L269.5 228.6 L266.9 229 L264.3 229.4 L261.7 229.6 L259.1 229.7 L256.5 229.7 L253.9 229.6 L251.3 229.4 L248.7 229 L246.1 228.6\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><path d=\"M338.2 102.5 Q334.8 104.7 329.8 101.6 M345.7 118.8 Q342 119.9 338.1 115.8 M348.6 136.4 Q344.9 136.5 342.3 131.6 M346.9 153.8 Q343.5 153 342.2 147.8 M341.4 169.9 Q338.3 168.5 338.1 163.3 M333.1 184.1 Q330.4 182.2 331.1 177.3 M323.1 196.3 Q320.8 194.1 322.1 189.5 M312 206.7 Q310 204.4 311.8 200.3 M299.9 215.8 Q298.3 213.3 300.5 209.6 M286.6 223.1 Q285.5 220.6 288.1 217.4 M272 228.1 Q271.4 225.5 274.5 223\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\".6\" stroke-linecap=\"round\"/><g fill=\"none\" stroke=\"url(#GID)\"><path d=\"M246.1 228.6 Q242.4 220.8 234.3 226.5 Q240 234.6 246.1 228.6\" fill=\"#6b1218\" stroke-width=\"1.1\"/><circle cx=\"239.2\" cy=\"227.4\" r=\"1.8\" fill=\"url(#GID)\" stroke=\"none\"/></g><path d=\"M330.5 81.9 L332.1 82.8 L333.7 83.7 L335.3 84.7 L336.9 85.7 L338.5 86.7 L340 87.8 L341.5 89 L343 90.1 L344.4 91.4 L345.8 92.6 L347.2 94 L348.5 95.3 L349.8 96.8 L351 98.2 L352.1 99.7 L353.2 101.3 L354.3 102.8 L355.2 104.5 L356.2 106.1 L357 107.8 L357.8 109.5 L358.6 111.3 L359.2 113 L359.9 114.8 L360.4 116.6 L360.9 118.5 L361.4 120.3 L361.8 122.2 L362.1 124 L362.4 125.9 L362.7 127.8 L362.9 129.6 L363.1 131.5 L363.2 133.4 L363.3 135.2 L363.4 137.1 L363.5 139 L363.5 140.9 L363.5 142.7 L363.5 144.6 L363.5 146.4 L363.5 148.3 L363.4 150.1 L363.4 152 L363.4 153.8 L363.3 155.7 L363.3 157.5 L363.2 159.4 L363.2 161.3 L363.2 163.1 L363.1 165 L363.1 166.9 L363.1 168.8 L363 170.7 L363 172.6 L362.9 174.5 L362.9 176.5 L362.8 178.4 L362.8 180.4 L362.7 182.4 L362.6 184.4 L362.4 186.4 L362.3 188.4 L362.1 190.4 L361.9 192.5 L361.6 194.5 L361.3 196.6 L361 198.6 L360.6 200.7 L360.2 202.7 L359.7 204.8 L359.2 206.8 L358.6 208.9 L358 210.9 L357.3 212.9 L356.5 214.9 L355.7 216.8 L354.8 218.8 L353.8 220.7 L352.8 222.5\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><path d=\"M345.8 92.6 Q343.1 95.5 337.4 93.8 M353.2 101.3 Q350 103.4 345 100.7 M358.6 111.3 Q355.1 112.7 351 109 M361.8 122.2 Q358.3 122.9 355 118.7 M363.2 133.4 Q359.8 133.6 357.2 129.2 M363.5 144.6 Q360.2 144.6 358 140.1 M363.3 155.7 Q360.1 155.6 358.1 151.3 M363.1 166.9 Q360.1 166.8 358.1 162.7 M362.8 178.4 Q359.9 178.3 358.1 174.4 M362.1 190.4 Q359.3 190.2 357.8 186.3 M360.2 202.7 Q357.6 202.2 356.7 198.3\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\".6\" stroke-linecap=\"round\"/><g fill=\"none\" stroke=\"url(#GID)\"><path d=\"M352.8 222.5 Q344.3 223.6 347.1 233.1 Q356.6 230.3 352.8 222.5\" fill=\"#6b1218\" stroke-width=\"1.1\"/><circle cx=\"349.5\" cy=\"228.7\" r=\"1.8\" fill=\"url(#GID)\" stroke=\"none\"/></g><path d=\"M311.7 78.8 L314.1 79.6 L316.5 80.5 L318.9 81.5 L321.3 82.6 L323.6 83.8 L325.9 85.1 L328.2 86.5 L330.4 88 L332.5 89.6 L334.5 91.2 L336.5 93 L338.4 94.9 L340.2 96.9 L341.9 98.9 L343.5 101.1 L345 103.3 L346.4 105.6 L347.6 107.9 L348.8 110.3 L349.8 112.8 L350.6 115.3 L351.4 117.9 L352.1 120.5 L352.6 123.1 L353 125.7 L353.2 128.4 L353.4 131 L353.5 133.7 L353.4 136.3 L353.3 139 L353 141.6 L352.7 144.2 L352.3 146.7 L351.8 149.3 L351.3 151.8 L350.7 154.3 L350 156.7 L349.3 159.1 L348.6 161.5 L347.8 163.9 L347 166.2 L346.2 168.6 L345.3 170.8 L344.5 173.1 L343.6 175.4 L342.8 177.6 L341.9 179.8 L341 182.1 L340.1 184.3 L339.2 186.5 L338.3 188.8 L337.4 191 L336.5 193.3 L335.6 195.5 L334.7 197.8 L333.7 200.1 L332.7 202.4 L331.7 204.7 L330.6 207 L329.5 209.4 L328.3 211.7 L327.1 214 L325.9 216.4 L324.5 218.7 L323.1 221 L321.6 223.3 L320.1 225.6 L318.5 227.9 L316.8 230.1 L315 232.2 L313.1 234.4 L311.1 236.4 L309 238.4 L306.9 240.3 L304.7 242.1 L302.3 243.8 L299.9 245.4 L297.5 246.9 L294.9 248.3 L292.3 249.5\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\"1.2\" stroke-linecap=\"round\"/><path d=\"M334.5 91.2 Q331.9 94.3 326.2 92.8 M345 103.3 Q341.7 105.3 336.8 102.4 M351.4 117.9 Q347.8 118.9 344.1 114.7 M353.5 133.7 Q349.9 133.7 347.5 128.9 M351.8 149.3 Q348.4 148.6 347.1 143.6 M347.8 163.9 Q344.7 162.9 344 158 M342.8 177.6 Q339.8 176.5 339.4 171.7 M337.4 191 Q334.6 189.9 334.3 185.3 M331.7 204.7 Q329 203.5 328.8 199.2 M324.5 218.7 Q322.1 217.3 322.4 213.2 M315 232.2 Q313 230.5 313.9 226.7\" fill=\"none\" stroke=\"url(#GID)\" stroke-width=\".6\" stroke-linecap=\"round\"/><g fill=\"none\" stroke=\"url(#GID)\"><path d=\"M292.3 249.5 Q284.8 245.4 281.5 254.8 Q290.9 258 292.3 249.5\" fill=\"#6b1218\" stroke-width=\"1.1\"/><circle cx=\"286\" cy=\"252.6\" r=\"1.8\" fill=\"url(#GID)\" stroke=\"none\"/></g><g fill=\"none\" stroke=\"url(#GID)\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n<path d=\"M329.9 58.8 Q344.2 59.8 358.6 49.6 Q340.9 44.1 329.9 58.8 Z\" fill=\"#6b1218\" stroke-width=\"1.2\"/><path d=\"M329.9 58.8 Q340.8 52.3 358.6 49.6\" stroke-width=\".6\"/><path d=\"M329.5 57.6 Q348.7 53.4 364.8 38.5 Q342.2 38.7 329.5 57.6 Z\" fill=\"#6b1218\" stroke-width=\"1.2\"/><path d=\"M329.5 57.6 Q343.4 47 364.8 38.5\" stroke-width=\".6\"/><path d=\"M328.9 56.5 Q350.4 45.8 365.9 25.8 Q341 32.8 328.9 56.5 Z\" fill=\"#6b1218\" stroke-width=\"1.2\"/><path d=\"M328.9 56.5 Q343.5 40.9 365.9 25.8\" stroke-width=\".6\"/><path d=\"M328 55.5 Q349.1 38.2 361.9 13.4 Q337.2 27.4 328 55.5 Z\" fill=\"#6b1218\" stroke-width=\"1.2\"/><path d=\"M328 55.5 Q341.1 35 361.9 13.4\" stroke-width=\".6\"/><path d=\"M327 54.8 Q344.5 32.5 352.4 4.8 Q330.7 24.5 327 54.8 Z\" fill=\"#6b1218\" stroke-width=\"1.2\"/><path d=\"M327 54.8 Q336 31.2 352.4 4.8\" stroke-width=\".6\"/><path d=\"M325.9 54.3 Q337.7 30.9 339.1 3.9 Q322.4 26 325.9 54.3 Z\" fill=\"#6b1218\" stroke-width=\"1.2\"/><path d=\"M325.9 54.3 Q329.2 31.2 339.1 3.9\" stroke-width=\".6\"/><path d=\"M324.6 54 Q330.9 33.1 326.2 10 Q314.9 31.4 324.6 54 Z\" fill=\"#6b1218\" stroke-width=\"1.2\"/><path d=\"M324.6 54 Q322.6 34.7 326.2 10\" stroke-width=\".6\"/><path d=\"M323.4 54 Q325.7 37.7 316.8 20.5 Q309.8 39.4 323.4 54 Z\" fill=\"#6b1218\" stroke-width=\"1.2\"/><path d=\"M323.4 54 Q317.9 40.5 316.8 20.5\" stroke-width=\".6\"/><path d=\"M323.1 50.7 q5 -7 10 0\" fill=\"#6b1218\" stroke-width=\"1\"/><path d=\"M326.1 52.3 q5 -7 10 0\" fill=\"#6b1218\" stroke-width=\"1\"/><path d=\"M328.5 54.6 q5 -7 10 0\" fill=\"#6b1218\" stroke-width=\"1\"/><path d=\"M330.1 57.5 q5 -7 10 0\" fill=\"#6b1218\" stroke-width=\"1\"/>\n<path d=\"M294 70 C296 58 312 50 326 54 C338 58 338 74 326 80 C316 84 304 82 294 70 Z\" fill=\"#6b1218\" stroke-width=\"1.5\"/>\n<path d=\"M304 70 q8 -5 16 0 M308 76 q8 -5 16 0\" stroke-width=\".8\"/>\n<path d=\"M302 64 C296 52 300 42 292 34\" stroke-width=\"3\"/>\n<g transform=\"translate(288,30) scale(1.25)\">\n<circle cx=\"0\" cy=\"0\" r=\"5.5\" fill=\"#6b1218\" stroke-width=\"1.5\"/>\n<path d=\"M-5 -1.5 L-15 2 L-5 3\" fill=\"url(#GID)\" stroke-width=\"1\"/>\n<circle cx=\"-1.5\" cy=\"-1\" r=\"1.2\" fill=\"url(#GID)\" stroke=\"none\"/>\n<path d=\"M-3 4 C-4 9 -1 12 2 10\" stroke-width=\"1\"/>\n<path d=\"M1 -5 C0 -14 6 -20 13 -18 C10 -16 10 -13 13 -12\" stroke-width=\"1.2\"/>\n<path d=\"M4 -4 C6 -11 13 -14 19 -11 C16 -10 16 -7 18 -6\" stroke-width=\"1\"/>\n<path d=\"M-2 -5 C-5 -12 -3 -18 2 -21 C1 -17 2 -15 4 -14\" stroke-width=\"1\"/>\n<circle cx=\"13\" cy=\"-15\" r=\"1.4\" fill=\"url(#GID)\" stroke=\"none\"/><circle cx=\"19\" cy=\"-8.5\" r=\"1.2\" fill=\"url(#GID)\" stroke=\"none\"/><circle cx=\"2.2\" cy=\"-18.5\" r=\"1.2\" fill=\"url(#GID)\" stroke=\"none\"/>\n</g></g><path d=\"M244 246 c-8 0 -10 -10 -3 -12 c2 -7 12 -7 14 -1 c3 -6 13 -5 13 2 c7 -1 10 8 3 11 Z M250 241 c3 -3 7 -2 7 1 M262 241 c2 -2 5 -1 5 1\" fill=\"#6b1218\" stroke=\"url(#GID)\" stroke-width=\"1.2\" stroke-linejoin=\"round\"/>";
  const DRAGON_HEAD = "<path d=\"M-4 -8 C-12 -14 -18 -22 -26 -22 M-2 -6 C-12 -10 -20 -12 -28 -10 M-2 6 L-10 10 L-4 3 L-14 4 L-4 0 L-12 -3 L-4 -4\" stroke-width=\"1\" fill=\"none\"/><path d=\"M-2 -8 C6 -12 14 -12 20 -9 C24 -8 28 -10 31 -7 C33 -4 30 -1 26 -1 L16 0 L26 3 C29 4 29 8 25 9 C16 11 6 10 -2 8 Z\" fill=\"#6b1218\" stroke-width=\"1.5\"/><path d=\"M16 0 L10 0\" stroke-width=\"1\"/><path d=\"M19 1.3 l1 2.2 M23 1.6 l1 2\" stroke-width=\".8\"/><path d=\"M8 -6 q4 -3 7 0 q-3.5 2.2 -7 0\" stroke-width=\"1.1\"/><circle cx=\"11.5\" cy=\"-5.8\" r=\"1.2\" fill=\"url(#GID)\" stroke=\"none\"/><path d=\"M4 -11 C2 -18 -6 -24 -14 -26 C-10 -22 -6 -18 -4 -12\" fill=\"url(#GID)\" stroke-width=\".8\"/><path d=\"M30 -8 C36 -12 42 -10 42 -4 C42 0 38 1 37 -2\" stroke-width=\"1\"/><path d=\"M24 9 C30 16 40 16 44 10 C46 7 43 5 41 7\" stroke-width=\"1\"/><path d=\"M4 9 C2 14 -2 16 -6 16\" stroke-width=\".9\"/>";
  const PHOENIX_HEAD = "<circle cx=\"0\" cy=\"0\" r=\"5.5\" fill=\"#6b1218\" stroke-width=\"1.5\"/><path d=\"M-5 -1.5 L-15 2 L-5 3\" fill=\"url(#GID)\" stroke-width=\"1\"/><circle cx=\"-1.5\" cy=\"-1\" r=\"1.2\" fill=\"url(#GID)\" stroke=\"none\"/><path d=\"M-3 4 C-4 9 -1 12 2 10\" stroke-width=\"1\"/><path d=\"M1 -5 C0 -14 6 -20 13 -18 C10 -16 10 -13 13 -12\" stroke-width=\"1.2\"/><path d=\"M4 -4 C6 -11 13 -14 19 -11 C16 -10 16 -7 18 -6\" stroke-width=\"1\"/><path d=\"M-2 -5 C-5 -12 -3 -18 2 -21 C1 -17 2 -15 4 -14\" stroke-width=\"1\"/><circle cx=\"13\" cy=\"-15\" r=\"1.4\" fill=\"url(#GID)\" stroke=\"none\"/><circle cx=\"19\" cy=\"-8.5\" r=\"1.2\" fill=\"url(#GID)\" stroke=\"none\"/><circle cx=\"2.2\" cy=\"-18.5\" r=\"1.2\" fill=\"url(#GID)\" stroke=\"none\"/>";
  const HY = 'M8 10H92M25 2V22M75 2V22M14 22H86M13 30h24v13h-24zM63 30h24v13h-24zM18 49l3 6M32 49l-3 6M68 49l3 6M82 49l-3 6M4 60H96M13 68h24v26h-24zM63 68h24v26h-24z'; // chữ 囍 vẽ bằng nét, để mọi máy hiển thị giống nhau
  let iconN = 0;
  function icon(kind) {
    const id = 'gold-i' + (iconN++), dragon = kind === 'trai';
    const body = (dragon ? DRAGON_HEAD : PHOENIX_HEAD).replaceAll('GID', id).replaceAll('#6b1218', '#7e1a20');
    return `<svg class="side-icon" viewBox="${dragon ? '-30 -30 78 50' : '-18 -26 42 40'}" aria-hidden="true">${goldDefs(id)}<g fill="none" stroke="url(#${id})" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  }
  function hySeal() { return `<svg viewBox="0 0 100 100" width="30" height="30" aria-hidden="true"><path d="${HY}" fill="none" stroke="#8e1a1f" stroke-width="7" stroke-linecap="square"/></svg>`; }
  function crest(style) {
    if (style === 'con_giap') return `<svg class="zodiac" viewBox="150 0 220 234" role="img" aria-label="Huy hiệu nét vàng: rắn và dê ôm quanh chữ Hỷ">${goldDefs('gold-z')}${CREST.replaceAll('GID', 'gold-z')}</svg>`;
    return `<svg class="zodiac long-phung" viewBox="140 0 240 262" role="img" aria-label="Huy hiệu Long Phụng nét vàng: rồng và phượng chầu ngọc quanh chữ Hỷ">${goldDefs('gold-z')}${LONG_PHUNG.replaceAll('GID', 'gold-z')}</svg>`;
  }
  let waveN = 0; iconN = 0;
  function wave() {
    const id = 'gold-w' + (waveN++);
    return `<svg class="wave" viewBox="0 0 520 22" preserveAspectRatio="none" aria-hidden="true">${goldDefs(id)}
      <path d="M0 11 C40 2 70 20 110 11 S180 2 220 11" fill="none" stroke="url(#${id})" stroke-width="1.4"/>
      <path d="M300 11 C340 20 370 2 410 11 S480 20 520 11" fill="none" stroke="url(#${id})" stroke-width="1.4"/>
      <circle cx="260" cy="11" r="5" fill="url(#${id})"/><circle cx="260" cy="11" r="8.5" fill="none" stroke="url(#${id})" stroke-width=".9"/>
      <path d="M249 9 c-4 -4 -9 -3 -10 1 M271 9 c4 -4 9 -3 10 1 M249 13 c-4 4 -9 3 -10 -1 M271 13 c4 4 9 3 10 -1" fill="none" stroke="url(#${id})" stroke-width="1"/></svg>`;
  }

  /* ---------- hiển thị ---------- */
  let S = null, giftSide = null;

  function render(keep) {
    waveN = 0;
    const { cfg: c, events, route, fromFar, guest: x, wishes } = S;
    const ad = esc(x.addr.toLowerCase()), r = x.rsvp, p = parseD(c.date), lp = c.crestStyle !== 'con_giap';
    giftSide = giftSide || x.side;
    const evs = events.slice().sort((a, b) => (evTime(a) || 0) - (evTime(b) || 0));
    const starts = (S.allEventTimes || events).map(evTime).filter(Boolean);
    const target = starts.length ? Math.min(...starts) : null;
    const left = target ? Math.max(0, target - Date.now()) : 0;
    const dd = Math.floor(left / D), hh = Math.floor(left % D / H), mi = Math.floor(left % H / 6e4);
    document.title = `Thiệp mời ${x.name} · ${c.groom} & ${c.bride}`;

    $('#app').innerHTML = `
  <section class="envelope" id="env" aria-label="Phong bì thiệp mời">
    <div class="env-label">Thiệp mời riêng gửi</div>
    <div class="env-name">${esc(x.name)}</div>
    <div class="env-from">từ ${esc(c.groom)} &amp; ${esc(c.bride)}</div>
    <button class="seal" id="seal" type="button" aria-label="Mở thiệp">${hySeal()}</button>
    <div class="seal-hint">Chạm con dấu để mở thiệp</div>
  </section>

  <section class="couple" id="top">
    <div class="song-hy">SONG HỶ · LỄ THÀNH HÔN</div>
    ${c.showCrest ? crest(c.crestStyle) : ''}
    <h1>${esc(c.groom)}<span class="amp">&amp;</span>${esc(c.bride)}</h1>
    ${p ? `<div class="date-line"><div>${wd(c.date)}<small>tháng ${p.m}</small></div><div class="big">${p.d}</div><div>${p.y}<small>dương lịch</small></div></div>
    ${c.lunar ? `<div class="lunar">Nhằm ngày ${esc(c.lunar)} âm lịch</div>` : ''}
    ${target && left > 0 ? `<div class="countdown" aria-label="Thời gian còn lại"><div><b>${dd}</b><span>ngày</span></div><div><b>${hh}</b><span>giờ</span></div><div><b>${mi}</b><span>phút</span></div></div>` : ''}`
        : `<div class="date-tbd">Ngày cưới sẽ được báo sau</div>`}
  </section>
  ${wave()}
  <section class="sec invite-text">
    <p>Trân trọng kính mời</p>
    <span class="who">${esc(x.addr)}${x.addr.toLowerCase() === x.name.toLowerCase() ? '' : ` · ${esc(x.name)}`}</span>
    <p>đến chung vui cùng gia đình chúng tôi trong ngày ${esc(c.groom)} và ${esc(c.bride)} nên duyên vợ chồng.<br>Sự hiện diện của ${ad} là niềm vinh hạnh cho hai gia đình.</p>
    <div class="parents">
      <div>${lp ? icon('trai') : ''}<b>Nhà trai</b>${esc(c.parents.trai.names).replace(/\n/g, '<br>')}<br><span class="muted">${esc(c.parents.trai.place)}</span></div>
      <div>${lp ? icon('gai') : ''}<b>Nhà gái</b>${esc(c.parents.gai.names).replace(/\n/g, '<br>')}<br><span class="muted">${esc(c.parents.gai.place)}</span></div>
    </div>
  </section>
  ${wave()}
  <section class="sec">
    <h2>Lịch trình dành cho ${ad}</h2>
    <p class="lead">Chỉ hiện những nghi lễ ${ad} được mời.</p>
    <div class="events">${evs.map(e => {
          const t = evTime(e); return `
      <article class="ev">
        <time>${esc(e.time || '--:--')}<small>${parseD(e.date) ? `${wd(e.date)} ${dmy(e.date).slice(0, 5)}` : 'ngày báo sau'}</small></time>
        <div><h3>${esc(e.name)}</h3><p>${[hostLabel(e.host), e.note].filter(Boolean).map(esc).join(' · ')}<br>${esc(e.place)}</p>
          <div class="chips">
            <a class="btn" href="${esc(mapLink(e))}" target="_blank" rel="noopener">Chỉ đường</a>
            ${t ? `<a class="btn" href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.name + ' ' + c.groom + ' & ' + c.bride)}&dates=${gcal(t)}/${gcal(t + 2 * H)}&location=${encodeURIComponent(e.place)}" target="_blank" rel="noopener">Thêm vào lịch</a>` : ''}
          </div></div>
      </article>`;
        }).join('') || '<p class="lead">Thông tin nghi lễ sẽ được cập nhật.</p>'}
    </div>
  </section>
  ${route.steps.length || c.helperPhone ? `${wave()}
  <section class="sec">
    <h2>Đường đến đám cưới${fromFar && route.label ? ` <span class="tag">từ ${esc(route.label)}</span>` : ''}</h2>
    <p class="lead">${fromFar && route.label ? `Gợi ý riêng cho khách đi từ ${esc(route.label)}.` : 'Thông tin gửi xe và đi lại.'}${c.helperPhone ? ` Cần hỗ trợ, gọi ${esc(c.helperName)}: <a href="tel:${esc(c.helperPhone.replace(/\s/g, ''))}"><b>${esc(c.helperPhone)}</b></a>` : ''}</p>
    <ol class="route">${route.steps.map(s => `<li><b>${esc(s[0])}</b><span>${esc(s[1])}</span></li>`).join('')}</ol>
  </section>` : ''}
  ${wave()}
  <section class="sec" id="rsvp">
    <h2>Xác nhận tham dự</h2>
    <p class="lead">Xin ${ad} phản hồi${dmy(c.rsvpBy) ? ` trước ${dmy(c.rsvpBy)}` : ''} để gia đình chuẩn bị chỗ ngồi chu đáo. Thiệp này giữ ${x.seats} chỗ.</p>
    ${r ? `<div class="done-box" id="rsvpDone">${rsvpSummary(x, events)} <button class="btn" type="button" id="editRsvp" style="margin-left:8px">Sửa</button></div>` : ''}
    <form class="rsvp ${r ? 'hidden' : ''}" id="rsvpForm">
      <div class="seg" role="radiogroup" aria-label="Có tham dự không">
        <input type="radio" name="st" id="st-yes" value="yes" ${r?.status === 'yes' || !r ? 'checked' : ''}><label for="st-yes">Sẽ đến</label>
        <input type="radio" name="st" id="st-maybe" value="maybe" ${r?.status === 'maybe' ? 'checked' : ''}><label for="st-maybe">Chưa chắc</label>
        <input type="radio" name="st" id="st-no" value="no" ${r?.status === 'no' ? 'checked' : ''}><label for="st-no">Không đến được</label>
      </div>
      <label class="field" for="ppl"><span>Số người đi cùng (tối đa ${x.seats})</span><input type="number" id="ppl" min="1" max="${x.seats}" value="${r?.people || x.seats}"></label>
      ${evs.length > 1 ? `<fieldset class="checks"><legend>Sẽ dự</legend>
        ${evs.map(e => `<label for="ev-${esc(e.id)}"><input type="checkbox" id="ev-${esc(e.id)}" value="${esc(e.id)}" ${!r || r.events?.includes(e.id) ? 'checked' : ''}> ${esc(e.name)} · ${esc(e.time)}</label>`).join('')}
      </fieldset>` : evs.map(e => `<input type="hidden" class="ev-hidden" value="${esc(e.id)}">`).join('')}
      ${fromFar ? `<fieldset class="checks"><legend>Hỗ trợ khách ở xa</legend>
        <label for="need-shuttle"><input type="checkbox" id="need-shuttle" ${r?.shuttle ? 'checked' : ''}> Cần xe đón ở sân bay / bến xe</label>
        <label for="need-room"><input type="checkbox" id="need-room" ${r?.room ? 'checked' : ''}> Cần hỗ trợ đặt phòng nghỉ</label></fieldset>` : ''}
      <label class="field" for="rnote"><span>Ghi chú (ăn chay, dị ứng, đi cùng trẻ nhỏ…)</span><textarea id="rnote" rows="2">${esc(r?.note || '')}</textarea></label>
      <div class="chips"><button class="btn solid" type="submit">Gửi xác nhận</button>${r ? '<button class="btn" type="button" id="cancelRsvp">Hủy, giữ như cũ</button>' : ''}</div>
    </form>
  </section>
  ${wave()}
  <section class="sec" id="wish">
    <h2>Sổ lưu bút</h2>
    <p class="lead">Để lại đôi lời cho ${esc(c.groom)} &amp; ${esc(c.bride)}. Lời chúc sẽ hiện cùng tên ${ad}.</p>
    <form id="wishForm" class="rsvp">
      <label class="field" for="wtext"><span class="sr">Lời chúc</span><textarea id="wtext" rows="3" maxlength="500" placeholder="Viết lời chúc…">${esc(x.wish?.text || '')}</textarea></label>
      <div><button class="btn solid" type="submit">${x.wish ? 'Cập nhật lời chúc' : 'Gửi lời chúc'}</button></div>
    </form>
    <div class="wishes">${wishes.map(o => `<div class="wish"><p>${esc(o.text)}</p><small>${esc(o.name)} · ${ago(o.at)}</small></div>`).join('') || '<small class="muted">Chưa có lời chúc nào.</small>'}</div>
  </section>
  ${c.bank.trai.acc || c.bank.gai.acc ? `${wave()}
  <section class="sec" id="gift">
    <h2>Gửi quà mừng từ xa</h2>
    <p class="lead">Dành cho ai ở xa hoặc không thể có mặt. Sự hiện diện và lời chúc đã là món quà quý nhất với chúng tôi.</p>
    <div id="giftClosed"><button class="btn" type="button" id="openGift">Hiện thông tin chuyển khoản</button></div>
    <div id="giftOpen" class="hidden">
      <div class="gift-tabs" role="group" aria-label="Chọn bên nhận">
        ${['trai', 'gai'].filter(s => c.bank[s].acc).map(s => `<button type="button" data-side="${s}" aria-pressed="${giftSide === s}">${lp ? icon(s) : ''}Mừng nhà ${s === 'trai' ? 'trai' : 'gái'}</button>`).join('')}
      </div>
      <div class="gift-body"><div class="qr-box"><div id="qr"></div></div><div class="bank" id="bankInfo"></div></div>
      <div class="gift-foot">
        <label class="field" for="gamt"><span>Số tiền đã gửi (không bắt buộc)</span><input type="number" id="gamt" min="0" step="50000" placeholder="Ví dụ 500000" value="${x.gift?.amount || ''}"></label>
        <div class="chips"><button class="btn solid" type="button" id="sentGift">${x.gift?.selfReported ? 'Đã báo gửi · cập nhật' : 'Tôi đã chuyển khoản'}</button><button class="btn" type="button" id="closeGift">Thu gọn</button></div>
      </div>
    </div>
  </section>` : ''}
  ${c.livestream ? `${wave()}
  <section class="sec center">
    <h2>Không thể đến?</h2>
    <p class="lead">Buổi lễ được phát trực tiếp cho người thân ở xa.</p>
    <a class="btn" href="${esc(c.livestream)}" target="_blank" rel="noopener">Mở link xem trực tiếp</a>
  </section>` : ''}
  <p class="foot">Thiệp riêng mã ${esc(x.code.toUpperCase())} · Xin đừng chuyển tiếp link này, vì phần xác nhận gắn với tên ${ad}.</p>`;

    bind();
    if (keep === 'gift') openGift();
  }

  function rsvpSummary(x, events) {
    const r = x.rsvp, m = { yes: 'Sẽ đến', maybe: 'Chưa chắc', no: 'Không đến được' }[r.status];
    const ev = (r.events || []).map(k => events.find(e => e.id === k)?.name).filter(Boolean).join(', ');
    return `<b>${m}</b>${r.status !== 'no' ? ` · ${r.people} người${ev ? ' · ' + esc(ev) : ''}` : ''}${r.shuttle ? ' · cần xe đón' : ''}${r.room ? ' · cần phòng' : ''}${r.note ? `<br><span class="muted">Ghi chú: ${esc(r.note)}</span>` : ''}`;
  }

  function backTo(id) { const s = $(id); if (s && s.getBoundingClientRect().top < 0) s.scrollIntoView({ behavior: still ? 'auto' : 'smooth' }); }
  function rerender(keep) { const y = scrollY; render(keep); scrollTo(0, y); }
  async function act(btn, action, body, okMsg, keep) {
    btn.disabled = true; const old = btn.textContent; btn.textContent = 'Đang gửi…';
    try {
      const res = await send(action, body);
      if (!res.ok) throw new Error(res.error || 'Lỗi');
      S.guest = res.guest;
      if (action === 'wish') S.wishes = [{ name: S.guest.name, text: body.text, at: Date.now() }].concat(S.wishes.filter(w => w.name !== S.guest.name));
      toast(okMsg); rerender(keep);
    } catch (e) { toast('Chưa gửi được: ' + e.message + '. Vui lòng thử lại.'); btn.disabled = false; btn.textContent = old; }
  }

  function openGift() { $('#giftClosed').classList.add('hidden'); $('#giftOpen').classList.remove('hidden'); drawGift(); }
  function drawGift() {
    const c = S.cfg; if (!c.bank[giftSide].acc) giftSide = c.bank.trai.acc ? 'trai' : 'gai';
    const b = c.bank[giftSide], memo = giftMemo(S.guest.code), box = $('#qr');
    document.querySelectorAll('.gift-tabs button').forEach(o => o.setAttribute('aria-pressed', o.dataset.side === giftSide));
    box.innerHTML = '';
    if (window.QRCode && b.bin) new QRCode(box, { text: vietqr({ bin: b.bin, acc: b.acc, memo }), width: 164, height: 164, correctLevel: QRCode.CorrectLevel.M });
    else box.innerHTML = '<div class="qr-missing">Không tạo được mã QR. Hãy chuyển khoản theo thông tin bên cạnh.</div>';
    $('#bankInfo').innerHTML = `<dl>
      <dt>Ngân hàng</dt><dd>${esc(b.bankName || BANK_NAMES[b.bin] || b.bin)}</dd>
      <dt>Chủ TK</dt><dd>${esc(b.holder)}</dd>
      <dt>Số TK</dt><dd><code>${esc(b.acc)}</code> <button class="btn mini" type="button" id="cpAcc">Sao chép</button></dd>
      <dt>Nội dung</dt><dd><code>${memo}</code> <button class="btn mini" type="button" id="cpMemo">Sao chép</button></dd>
    </dl><p class="hint">Mở app ngân hàng và quét mã. Nội dung đã điền sẵn để cô dâu chú rể biết quà của ai và gửi lời cảm ơn.</p>`;
    $('#cpAcc').onclick = () => copy(b.acc, 'Đã sao chép số tài khoản');
    $('#cpMemo').onclick = () => copy(memo, 'Đã sao chép nội dung chuyển khoản');
  }

  function bind() {
    $('#seal').onclick = () => { $('#env').classList.add('opened'); $('#top').scrollIntoView({ behavior: still ? 'auto' : 'smooth' }); };
    const ed = $('#editRsvp'); if (ed) ed.onclick = () => { $('#rsvpDone').classList.add('hidden'); $('#rsvpForm').classList.remove('hidden'); };
    const cr = $('#cancelRsvp'); if (cr) cr.onclick = () => { $('#rsvpForm').reset(); $('#rsvpForm').classList.add('hidden'); $('#rsvpDone').classList.remove('hidden'); backTo('#rsvp'); $('#editRsvp').focus(); };
    $('#rsvpForm').onsubmit = e => {
      e.preventDefault();
      const st = document.querySelector('input[name=st]:checked').value;
      const evs = [...document.querySelectorAll('#rsvpForm input[id^=ev-]:checked, #rsvpForm .ev-hidden')].map(i => i.value);
      act(e.submitter || $('#rsvpForm button[type=submit]'), 'rsvp', {
        status: st, people: Math.min(S.guest.seats, Math.max(1, +$('#ppl').value || 1)), events: evs,
        shuttle: !!$('#need-shuttle')?.checked, room: !!$('#need-room')?.checked, note: $('#rnote').value.trim()
      }, st === 'no' ? 'Đã ghi nhận. Cảm ơn bạn đã báo trước!' : 'Đã ghi nhận xác nhận. Hẹn gặp bạn!');
    };
    $('#wishForm').onsubmit = e => {
      e.preventDefault(); const t = $('#wtext').value.trim(); if (!t) { toast('Bạn chưa viết lời chúc'); return; }
      act(e.submitter || $('#wishForm button'), 'wish', { text: t }, 'Cảm ơn lời chúc của bạn!');
    };
    if ($('#openGift')) {
      $('#openGift').onclick = openGift;
      $('#closeGift').onclick = () => { $('#giftOpen').classList.add('hidden'); $('#giftClosed').classList.remove('hidden'); backTo('#gift'); $('#openGift').focus(); };
      document.querySelectorAll('.gift-tabs button').forEach(b => b.onclick = () => { giftSide = b.dataset.side; drawGift(); });
      $('#sentGift').onclick = e => act(e.currentTarget, 'gift', { side: giftSide, amount: Math.max(0, +$('#gamt').value || 0) }, 'Cảm ơn bạn! Cô dâu chú rể sẽ nhận được thông báo.', 'gift');
    }
  }

  /* ---------- khởi động ---------- */
  (async function start() {
    if (!CODE && !DEMO) { $('#app').innerHTML = '<p class="sec center">Link thiệp chưa đúng. Vui lòng mở lại link riêng được gửi cho bạn.</p>'; return; }
    try {
      const data = await load();
      if (!data.ok) throw new Error(data.error);
      S = data; render();
      const k = 'viewed-' + CODE;
      if (!DEMO && !sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); send('view', {}).catch(() => { }); }
    } catch (e) {
      $('#app').innerHTML = `<div class="sec center"><h2>Chưa mở được thiệp</h2><p class="lead">${esc(e.message)}</p><button class="btn" type="button" onclick="location.reload()">Thử lại</button></div>`;
    }
  })();
})();
