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
  /* Hình rồng phượng nằm trong assets/*.svg (vẽ lại từ mẫu đã chọn), tô vàng ánh kim bằng CSS mask, xem lớp .art trong style.css. */
  const HY = 'M8 10H92M25 2V22M75 2V22M14 22H86M13 30h24v13h-24zM63 30h24v13h-24zM18 49l3 6M32 49l-3 6M68 49l3 6M82 49l-3 6M4 60H96M13 68h24v26h-24zM63 68h24v26h-24z'; // chữ 囍 vẽ bằng nét, để mọi máy hiển thị giống nhau
  function hySeal(size = 30) { return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><path d="${HY}" fill="none" stroke="#8e1a1f" stroke-width="7" stroke-linecap="square"/></svg>`; }
  function crest() { return '<div class="art art-lvpt" role="img" aria-label="Long Vũ Phượng Tường: rồng và phượng múa, dải lụa vàng ôm đôi nhẫn cưới"></div>'; }
  let waveN = 0;
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
  // Khách chỉ thấy phong bì; chạm con dấu mới mở ruột thiệp. Nhớ trong phiên để tải lại hoặc gửi xác nhận không phải mở lại.
  const OPEN_KEY = 'opened-' + CODE;
  let opened = (() => { try { return sessionStorage.getItem(OPEN_KEY) === '1'; } catch (e) { return false; } })() || /^#(rsvp|wish|gift)$/.test(location.hash);

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

    $('#app').classList.toggle('sealed', !opened);
    $('#app').innerHTML = `
  <section class="envelope" id="env" aria-label="Phong bì thiệp mời" ${opened ? 'hidden' : ''}>
    <div class="env-label">Thiệp mời riêng gửi</div>
    <div class="env-name">${esc(x.name)}</div>
    <div class="env-from">từ ${esc(c.groom)} &amp; ${esc(c.bride)}</div>
    <div class="emblem" role="img" aria-label="Rồng phượng uốn quanh viên ngọc theo thế âm dương"><div class="art art-vong"></div><button class="seal" id="seal" type="button" aria-label="Mở thiệp">${hySeal()}</button></div>
    <div class="seal-hint">Chạm con dấu để mở thiệp</div>
  </section>

  <div class="inside" id="inside" ${opened ? '' : 'hidden'}>
  <div class="cover"><section class="couple" id="top" tabindex="-1">
    <div class="song-hy">SONG HỶ · LỄ THÀNH HÔN</div>
    ${c.showCrest ? crest() : ''}
    <h1>${esc(c.groom)}<span class="amp">&amp;</span>${esc(c.bride)}</h1>
    ${p ? `<div class="date-line"><div>${wd(c.date)}<small>tháng ${p.m}</small></div><div class="big">${p.d}</div><div>${p.y}<small>dương lịch</small></div></div>
    ${c.lunar ? `<div class="lunar">Nhằm ngày ${esc(c.lunar)} âm lịch</div>` : ''}
    ${target && left > 0 ? `<div class="countdown" aria-label="Thời gian còn lại"><div><b>${dd}</b><span>ngày</span></div><div><b>${hh}</b><span>giờ</span></div><div><b>${mi}</b><span>phút</span></div></div>` : ''}`
        : `<div class="date-tbd">Ngày cưới sẽ được báo sau</div>`}
  </section></div>
  <div class="details">
  ${wave()}
  <section class="sec invite-text">
    <div class="parents">
      <div><b>Nhà trai</b>${esc(c.parents.trai.names).replace(/\n/g, '<br>')}<br><span class="muted">${esc(c.parents.trai.place)}</span></div>
      <div><b>Nhà gái</b>${esc(c.parents.gai.names).replace(/\n/g, '<br>')}<br><span class="muted">${esc(c.parents.gai.place)}</span></div>
    </div>
    <p>Trân trọng kính mời</p>
    <span class="who">${esc(x.addr)}${x.addr.toLowerCase() === x.name.toLowerCase() ? '' : ` · ${esc(x.name)}`}</span>
    <p>đến chung vui cùng gia đình chúng tôi trong ngày ${esc(c.groom)} và ${esc(c.bride)} nên duyên vợ chồng.<br>Sự hiện diện của ${ad} là niềm vinh hạnh cho hai gia đình.</p>
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
      <div class="gift-body"><div class="qr-frame"><div class="qr-box"><div id="qr"></div><span class="qr-hy" id="qrHy">${hySeal(40)}</span></div></div><div class="bank" id="bankInfo"></div></div>
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
  <p class="foot">Thiệp riêng mã ${esc(x.code.toUpperCase())} · Xin đừng chuyển tiếp link này, vì phần xác nhận gắn với tên ${ad}.</p>
  </div></div>`;

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
    const ok = !!(window.QRCode && b.bin);
    // mức sửa lỗi H để chữ 囍 che giữa mã vẫn quét được; vẽ 328px rồi thu nhỏ cho nét trên màn hình sắc
    if (ok) new QRCode(box, { text: vietqr({ bin: b.bin, acc: b.acc, memo }), width: 328, height: 328, colorDark: '#3d0a0d', colorLight: '#fffaf0', correctLevel: QRCode.CorrectLevel.H });
    else box.innerHTML = '<div class="qr-missing">Không tạo được mã QR. Hãy chuyển khoản theo thông tin bên dưới.</div>';
    $('#qrHy').classList.toggle('hidden', !ok);
    $('#bankInfo').innerHTML = `<dl>
      <dt>Ngân hàng</dt><dd>${esc(b.bankName || BANK_NAMES[b.bin] || b.bin)}</dd>
      <dt>Chủ TK</dt><dd>${esc(b.holder)}</dd>
      <dt>Số TK</dt><dd><code>${esc(b.acc)}</code> <button class="btn mini" type="button" id="cpAcc">Sao chép</button></dd>
      <dt>Nội dung</dt><dd><code>${memo}</code> <button class="btn mini" type="button" id="cpMemo">Sao chép</button></dd>
    </dl><p class="hint">Mở app ngân hàng và quét mã. Nội dung đã điền sẵn để cô dâu chú rể biết quà của ai và gửi lời cảm ơn.</p>`;
    $('#cpAcc').onclick = () => copy(b.acc, 'Đã sao chép số tài khoản');
    $('#cpMemo').onclick = () => copy(memo, 'Đã sao chép nội dung chuyển khoản');
  }

  function openCard() {
    if (opened) return;
    opened = true;
    try { sessionStorage.setItem(OPEN_KEY, '1'); } catch (e) { }
    $('#env').classList.add('opened');
    const show = () => {
      $('#env').hidden = true; $('#app').classList.remove('sealed');
      const ins = $('#inside'); ins.hidden = false; ins.classList.add('reveal');
      scrollTo(0, 0); $('#top').focus({ preventScroll: true });
    };
    if (still) show(); else setTimeout(show, 900);
  }

  function bind() {
    $('#env').onclick = openCard; // chạm con dấu hoặc bất kỳ đâu trên phong bì
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
      if (opened && location.hash) { const t = document.querySelector(location.hash); if (t) t.scrollIntoView(); }
      const k = 'viewed-' + CODE;
      if (!DEMO && !sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); send('view', {}).catch(() => { }); }
    } catch (e) {
      $('#app').innerHTML = `<div class="sec center"><h2>Chưa mở được thiệp</h2><p class="lead">${esc(e.message)}</p><button class="btn" type="button" onclick="location.reload()">Thử lại</button></div>`;
    }
  })();
})();
