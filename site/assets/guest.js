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
  function crest() { return `<svg class="zodiac" viewBox="150 0 220 234" role="img" aria-label="Huy hiệu nét vàng: rắn và dê ôm quanh chữ Hỷ">${goldDefs('gold-z')}${CREST.replaceAll('GID', 'gold-z')}</svg>`; }
  let waveN = 0;
  function wave() {
    const id = 'gold-w' + (waveN++);
    return `<svg class="wave" viewBox="0 0 520 22" preserveAspectRatio="none" aria-hidden="true">${goldDefs(id)}
      <path d="M0 11 C40 2 70 20 110 11 S180 2 220 11" fill="none" stroke="url(#${id})" stroke-width="1.4"/>
      <path d="M300 11 C340 20 370 2 410 11 S480 20 520 11" fill="none" stroke="url(#${id})" stroke-width="1.4"/>
      <path d="M260 4 L267 11 L260 18 L253 11 Z" fill="url(#${id})"/></svg>`;
  }

  /* ---------- hiển thị ---------- */
  let S = null, giftSide = null;

  function render(keep) {
    waveN = 0;
    const { cfg: c, events, route, fromFar, guest: x, wishes } = S;
    const ad = esc(x.addr.toLowerCase()), r = x.rsvp, p = parseD(c.date);
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
    <button class="seal" id="seal" type="button" aria-label="Mở thiệp">囍</button>
    <div class="seal-hint">Chạm con dấu để mở thiệp</div>
  </section>

  <section class="couple" id="top">
    <div class="song-hy">SONG HỶ · LỄ THÀNH HÔN</div>
    ${c.showCrest ? crest() : ''}
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
      <div><b>Nhà trai</b>${esc(c.parents.trai.names).replace(/\n/g, '<br>')}<br><span class="muted">${esc(c.parents.trai.place)}</span></div>
      <div><b>Nhà gái</b>${esc(c.parents.gai.names).replace(/\n/g, '<br>')}<br><span class="muted">${esc(c.parents.gai.place)}</span></div>
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
        ${['trai', 'gai'].filter(s => c.bank[s].acc).map(s => `<button type="button" data-side="${s}" aria-pressed="${giftSide === s}">Mừng nhà ${s === 'trai' ? 'trai' : 'gái'}</button>`).join('')}
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
