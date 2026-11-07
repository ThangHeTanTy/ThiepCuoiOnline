/* Trang quản trị: đăng nhập Google, đọc số liệu từ Apps Script, thêm khách, đối soát sao kê. */
(function () {
  const CFG = window.THIEP || {};
  const $ = s => document.querySelector(s);
  const TOKEN_KEY = 'thiep-admin-token';
  let token = sessionStorage.getItem(TOKEN_KEY) || '';
  let D = null, tab = 'list', filter = 'all', query = '';

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2600); }
  async function copy(text, msg) { try { await navigator.clipboard.writeText(text); toast(msg || 'Đã sao chép'); } catch (e) { toast('Trình duyệt chặn sao chép'); } }
  function ago(t) { if (!t) return ''; const m = Math.round((Date.now() - t) / 6e4); if (m < 60) return Math.max(0, m) + ' phút trước'; const h = Math.round(m / 60); if (h < 24) return h + ' giờ trước'; return Math.round(h / 24) + ' ngày trước'; }
  function vnd(n) { return n ? Number(n).toLocaleString('vi-VN') + ' ₫' : '—'; }
  function noAccent(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D'); }
  function parseD(d) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; }
  function dmy(d) { const p = parseD(d); return p ? `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}` : 'chưa chốt'; }
  const giftMemo = c => ('MUNG CUOI ' + c).toUpperCase();
  const ROLE_LABEL = { owner: 'Chủ thiệp', full: 'Quản trị toàn bộ', gai: 'Quản lý nhà gái', trai: 'Quản lý nhà trai', view: 'Chỉ xem' };

  async function api(action, body) {
    const r = await fetch(CFG.apiUrl, { method: 'POST', body: JSON.stringify(Object.assign({ action, idToken: token }, body || {})) });
    const j = await r.json();
    if (!j.ok) {
      if (/đăng nhập|hết hạn|Sai GOOGLE/i.test(j.error || '')) { logout(j.error); }
      throw new Error(j.error || 'Lỗi máy chủ');
    }
    return j;
  }

  /* ---------- đăng nhập ---------- */
  function showLogin(msg) {
    $('#adminView').classList.add('hidden'); $('#loginView').classList.remove('hidden'); $('#loginErr').textContent = msg || '';
    if (!CFG.apiUrl || !CFG.googleClientId) { $('#loginErr').textContent = 'Chưa cấu hình apiUrl hoặc googleClientId trong config.js (xem README).'; return; }
    const init = () => {
      if (!window.google?.accounts?.id) { setTimeout(init, 200); return; }
      google.accounts.id.initialize({ client_id: CFG.googleClientId, callback: r => { token = r.credential; sessionStorage.setItem(TOKEN_KEY, token); loadData(); } });
      google.accounts.id.renderButton($('#gbtn'), { theme: 'outline', size: 'large', text: 'signin_with', locale: 'vi' });
    };
    init();
  }
  function logout(msg) { token = ''; sessionStorage.removeItem(TOKEN_KEY); try { google.accounts.id.disableAutoSelect(); } catch (e) { } showLogin(msg); }

  async function loadData() {
    try {
      D = await api('admin.data');
      $('#loginView').classList.add('hidden'); $('#adminView').classList.remove('hidden');
      render();
    } catch (e) { if (token) showLogin(e.message); }
  }

  /* ---------- hiển thị ---------- */
  const FILTERS = [['all', 'Tất cả'], ['unseen', 'Chưa mở thiệp'], ['seen-no', 'Đã xem, chưa trả lời'], ['yes', 'Sẽ đến'], ['maybe', 'Chưa chắc'], ['no', 'Không đến'], ['far', 'Khách ở xa'], ['gift', 'Có mừng']];
  function matchF(x, f) { switch (f) { case 'unseen': return !x.views; case 'seen-no': return x.views && !x.rsvp; case 'yes': case 'maybe': case 'no': return x.rsvp?.status === f; case 'far': return !!x.from; case 'gift': return !!x.gift; default: return true; } }
  const canEdit = () => D.me.role !== 'view';
  const linkFor = code => (D.cfg.siteUrl || '').replace(/\/?$/, '/') + 'm/' + code + '/';
  const evName = id => D.events.find(e => e.id === id)?.name;
  const routeLabel = k => D.routes.find(r => r.code === k)?.label || k;

  function render() {
    const c = D.cfg, G = D.guests;
    $('#adminTitle').textContent = `Quản lý thiệp mời · ${c.groom} & ${c.bride}`;
    $('#adminSub').textContent = `${parseD(c.date) ? 'Ngày cưới ' + dmy(c.date) : 'Ngày cưới chưa chốt'} · Hạn xác nhận ${dmy(c.rsvpBy)}`;
    $('#roleBadge').textContent = `${D.me.email} · ${ROLE_LABEL[D.me.role]}`;
    const seen = G.filter(x => x.views).length, seats = G.reduce((s, x) => s + x.seats, 0), exp = +c.expected || 0;
    const yes = G.filter(x => x.rsvp?.status === 'yes'), maybe = G.filter(x => x.rsvp?.status === 'maybe');
    const pYes = yes.reduce((s, x) => s + x.rsvp.people, 0), pMaybe = maybe.reduce((s, x) => s + x.rsvp.people, 0);
    const reported = G.filter(x => x.gift?.selfReported), matched = G.filter(x => x.gift?.matched);
    const shuttle = G.filter(x => x.rsvp?.shuttle && x.rsvp.status !== 'no').length, room = G.filter(x => x.rsvp?.room && x.rsvp.status !== 'no').length;
    const tile = (n, l, pct) => `<div class="tile"><div class="n">${n}</div><div class="l">${l}</div>${pct != null ? `<div class="bar"><i style="width:${Math.min(100, Math.round(pct * 100))}%"></i></div>` : ''}</div>`;
    $('#tiles').innerHTML =
      tile(`${seats}/${exp || '?'}`, 'ghế đã mời / khách dự kiến', exp ? seats / exp : null) +
      tile(`${seen}/${G.length}`, 'thiệp đã được mở', G.length ? seen / G.length : 0) +
      tile(pYes, `người chắc chắn đến (+${pMaybe} chưa chắc)`, seats ? pYes / seats : 0) +
      tile(G.filter(x => !x.rsvp).length, 'thiệp chưa trả lời') +
      tile(G.filter(x => x.rsvp?.status === 'no').length, 'báo không đến được') +
      tile(G.filter(x => x.wish).length, 'lời chúc') +
      tile(`${matched.length} · ${reported.length}`, 'quà khớp sao kê · khách tự báo') +
      tile(`${shuttle} · ${room}`, 'cần xe đón · cần phòng');
    document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
    ['list', 'import', 'wish', 'gift', 'settings'].forEach(k => $('#panel-' + k).classList.toggle('hidden', k !== tab));
    $('#filters').innerHTML = FILTERS.map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${filter === k}">${l} (${G.filter(x => matchF(x, k)).length})</button>`).join('') +
      `<label for="q" class="sr">Tìm khách</label><input id="q" type="search" placeholder="Tìm theo tên…" value="${esc(query)}">`;
    document.querySelectorAll('#filters button').forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
    $('#q').oninput = e => { query = e.target.value; renderRows(); };
    renderRows(); renderImport(); renderWishes(); renderGifts(); renderSettings();
  }

  function inviteMsg(x) {
    const c = D.cfg;
    return `${x.addr} ơi, ${c.groom} & ${c.bride} gửi ${x.addr.toLowerCase()} thiệp mời cưới riêng nè: ${linkFor(x.code)}\nMong ${x.addr.toLowerCase()} bấm xác nhận giúp tụi em${parseD(c.rsvpBy) ? ' trước ' + dmy(c.rsvpBy) : ''} nhé!`;
  }
  function statusPill(x) {
    if (!x.rsvp) return x.views ? '<span class="pill p-warn">Chưa trả lời</span>' : '—';
    const r = x.rsvp; if (r.status === 'yes') return `<span class="pill p-ok">Đến · ${r.people} người</span>`;
    if (r.status === 'maybe') return `<span class="pill p-warn">Chưa chắc · ${r.people}</span>`; return '<span class="pill p-bad">Không đến</span>';
  }
  function giftPill(x) {
    const g = x.gift; if (!g) return '—';
    if (g.matched) return `<span class="pill p-ok">Sao kê ${vnd(g.matchedAmount)}</span>${g.selfReported ? '' : '<div class="meta">khách không báo</div>'}`;
    return `<span class="pill p-info">Báo gửi${g.amount ? ' ' + vnd(g.amount) : ''}</span>`;
  }
  function renderRows() {
    const q = noAccent(query.toLowerCase());
    const list = D.guests.filter(x => matchF(x, filter)).filter(x => !q || noAccent(x.name.toLowerCase()).includes(q));
    $('#rows').innerHTML = list.map(x => {
      const ev = x.events.map(evName).filter(Boolean).join(', ');
      const gmail = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent('Thiệp mời cưới ' + D.cfg.groom + ' & ' + D.cfg.bride)}&body=${encodeURIComponent(inviteMsg(x))}`;
      return `<tr>
        <td><div class="nm">${esc(x.name)}</div><div class="meta">Nhà ${x.side === 'trai' ? 'trai' : 'gái'} · ${x.seats} ghế · ${esc(ev)}${x.from ? ` · từ ${esc(routeLabel(x.from))}` : ''}</div>${x.internalNote ? `<div class="meta">${esc(x.internalNote)}</div>` : ''}</td>
        <td class="linkcell"><code>${esc(linkFor(x.code))}</code></td>
        <td>${x.views ? `<span class="pill p-ok">${x.views} lần</span><div class="meta">${ago(x.lastView)}</div>` : '<span class="pill p-none">Chưa mở</span>'}</td>
        <td>${statusPill(x)}${x.rsvp?.note ? `<div class="meta">${esc(x.rsvp.note)}</div>` : ''}</td>
        <td>${x.rsvp && x.rsvp.status !== 'no' ? [x.rsvp.shuttle ? '<span class="pill p-info">Xe đón</span>' : '', x.rsvp.room ? '<span class="pill p-info">Phòng</span>' : ''].filter(Boolean).join(' ') || '—' : '—'}</td>
        <td>${x.wish ? '<span class="pill p-ok">Có</span>' : '—'}</td>
        <td>${giftPill(x)}</td>
        <td><div class="acts">
          <button class="abtn primary" type="button" data-copy="${esc(x.code)}">Copy tin mời (Zalo/Messenger)</button>
          <a class="abtn" href="${gmail}" target="_blank" rel="noopener">Soạn Gmail</a>
          <a class="abtn" href="${esc(linkFor(x.code))}" target="_blank" rel="noopener">Xem thiệp</a>
        </div></td></tr>`;
    }).join('') || '<tr><td colspan="8" class="sub">Không có khách nào khớp bộ lọc.</td></tr>';
    document.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(inviteMsg(D.guests.find(g => g.code === b.dataset.copy)), 'Đã sao chép tin mời. Dán vào Zalo hoặc Messenger để gửi.'));
  }
  function renderImport() {
    const ids = D.events.map(e => `<b>${esc(e.id)}</b> = ${esc(e.name)}`).join(', ');
    const origins = D.routes.filter(r => r.code).map(r => `<b>${esc(r.code)}</b> = ${esc(r.label)}`).join(', ');
    $('#importHelp').innerHTML = `Mỗi dòng một khách, cột cách nhau bằng <b>|</b>:<br>Tên hiển thị | Cách gọi trong lời mời | Bên (trai/gái) | Số ghế | Mã nghi lễ | Mã nơi xuất phát<br>Mã nghi lễ: ${ids || 'chưa có'}.<br>Mã nơi xuất phát: ${origins || 'chưa có'} (để trống nếu ở gần).` +
      (D.me.role === 'gai' || D.me.role === 'trai' ? `<br>Bạn đang quản lý ${D.me.role === 'gai' ? 'nhà gái' : 'nhà trai'}: mọi dòng sẽ gán về bên này.` : '');
    $('#doImport').disabled = !canEdit();
  }
  function renderWishes() {
    const w = D.guests.filter(x => x.wish).sort((a, b) => (b.wish.at || 0) - (a.wish.at || 0));
    $('#wishList').innerHTML = w.map(x => `<div class="item"><div><b>${esc(x.name)}</b> <small>· ${ago(x.wish.at)}</small><p>${esc(x.wish.text)}</p></div></div>`).join('') || '<p class="note">Chưa có lời chúc.</p>';
  }
  function renderGifts() {
    const gs = D.guests.filter(x => x.gift);
    $('#giftList').innerHTML = gs.map(x => `<div class="item"><div><b>${esc(x.name)}</b> <small>· ${giftMemo(x.code)}</small>
      <p>${x.gift.selfReported ? `Khách báo ${vnd(x.gift.amount)}` : 'Khách không báo'} · ${x.gift.matched ? `<span class="pill p-ok">Sao kê ${vnd(x.gift.matchedAmount)}</span>` : '<span class="pill p-info">Chờ đối soát</span>'}</p></div></div>`).join('') || '<p class="note">Chưa có quà nào được ghi nhận.</p>';
    $('#doMatch').disabled = !canEdit();
  }
  function renderSettings() {
    const a = [];
    if (D.sheetUrl) a.push(`<a class="abtn primary" href="${esc(D.sheetUrl)}" target="_blank" rel="noopener">Mở Google Sheet</a>`);
    if (D.me.role === 'owner' || D.me.role === 'full') a.push('<button class="abtn" type="button" id="rebuild">Xuất bản lại thiệp</button>');
    $('#sheetActs').innerHTML = a.join('') || '<span class="sub">Vai trò của bạn không sửa được cài đặt. Liên hệ chủ thiệp.</span>';
    const rb = $('#rebuild'); if (rb) rb.onclick = async () => { rb.disabled = true; try { const r = await api('admin.rebuild'); toast(r.ok ? 'Đã yêu cầu GitHub xuất bản lại (1–3 phút)' : r.error); } catch (e) { toast(e.message); } rb.disabled = false; };
  }

  /* ---------- thao tác ---------- */
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
  $('#reload').onclick = () => loadData().then(() => toast('Đã tải lại'));
  $('#logout').onclick = () => logout('');
  $('#doImport').onclick = async e => {
    const btn = e.currentTarget; btn.disabled = true;
    try {
      const r = await api('admin.addGuests', { lines: $('#importText').value });
      $('#importMsg').textContent = `Đã thêm ${r.added} khách${r.bad.length ? `, bỏ qua dòng ${r.bad.join(', ')} vì thiếu tên` : ''}. ${r.rebuild?.ok ? 'GitHub đang xuất bản trang thiệp mới.' : (r.rebuild?.error || '')}`;
      $('#importText').value = ''; await loadData();
    } catch (err) { toast(err.message); }
    btn.disabled = false;
  };
  $('#doMatch').onclick = async e => {
    const btn = e.currentTarget; btn.disabled = true;
    try {
      const r = await api('admin.match', { text: $('#stmt').value });
      const ok = r.results.filter(x => x.status === 'ok'), sum = ok.reduce((s, x) => s + x.amount, 0);
      const label = { ok: '<span class="pill p-ok">Khớp</span>', nocode: '<span class="pill p-warn">Không có mã, kiểm tra tay</span>', unknown: '<span class="pill p-bad">Mã không có trong danh sách</span>', other: '<span class="pill p-none">Khách bên kia, bỏ qua</span>' };
      $('#matchResult').innerHTML = `<p><b>${ok.length}/${r.results.length}</b> giao dịch khớp khách · tổng ${vnd(sum)}</p><div class="list">${r.results.map(x => `<div class="item"><div><small class="mono">${esc(x.line)}</small><p>${label[x.status]} ${x.name ? `<b>${esc(x.name)}</b> · ` : ''}${vnd(x.amount)}</p></div></div>`).join('')}</div>`;
      await loadData();
    } catch (err) { toast(err.message); }
    btn.disabled = false;
  };
  $('#copyCsv').onclick = () => {
    const st = { yes: 'Sẽ đến', maybe: 'Chưa chắc', no: 'Không đến' };
    const rows = [['Mã', 'Khách', 'Bên', 'Ghế', 'Link', 'Lượt xem', 'Xác nhận', 'Số người', 'Xe đón', 'Phòng', 'Ghi chú', 'Lời chúc', 'Khách báo (VND)', 'Sao kê (VND)']]
      .concat(D.guests.map(x => [x.code, x.name, x.side === 'trai' ? 'Nhà trai' : 'Nhà gái', x.seats, linkFor(x.code), x.views, x.rsvp ? st[x.rsvp.status] : 'Chưa trả lời', x.rsvp?.people ?? '', x.rsvp?.shuttle ? 'x' : '', x.rsvp?.room ? 'x' : '', x.rsvp?.note || '', x.wish?.text || '', x.gift?.amount || '', x.gift?.matchedAmount || '']));
    copy(rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'), 'Đã sao chép CSV');
  };
  $('#copyRemind').onclick = () => {
    const list = D.guests.filter(x => !x.rsvp);
    copy(list.map(x => `${x.name} (${x.views ? 'đã xem, chưa trả lời' : 'chưa mở thiệp'}): ${linkFor(x.code)}`).join('\n'), `Đã sao chép ${list.length} khách cần nhắc`);
  };

  if (token) loadData(); else showLogin('');
})();
