// 출처: 팀 Drive 20261031_SEW_카톡시즌지도DB화 (v1_app_chat.js, 송은우)
// 총무방 카톡 집계(시연용 사전 집계) — B: 추천 패널 아래 "총무방 대화" 섹션 / C: 시즌 지도 작은 카드 + 큰 팝업.
// 읽기 전용이다. 날짜 일정으로 등록하지 않고(월·주 단위 자료라 날짜를 만들 수 없음), 공문 추천의 순위·후보에 영향을 주지 않는다.
// 업무명은 AI가 붙인 해석이다. 대화 원문은 앱에도 DB에도 없다.
(function () {
  const K = OB.core, esc = K.esc;
  const ui = () => (OB.app.ui.chat = OB.app.ui.chat || { tab: 'map', sort: 'total', q: '', open: null });
  const enabled = st => OB.ai.chatLive() && st.user.job === OB.config.RECOMMEND_JOB;
  const rerender = () => { if (location.hash === '#/work') OB.app.render(); };
  const md = iso => { const d = K.parseISO(iso); return (d.getMonth() + 1) + '/' + d.getDate(); };
  const yearsText = py => Object.keys(py).sort().map(y => y + '년 ' + py[y] + '건').join(' · ');
  const TIP = '대화량은 업무량이 아니라, 그 시기에 사람들이 궁금해하거나 헷갈려 한 정도예요. 업무 이름은 AI가 붙인 해석이에요.';

  function load(state) {
    const s = ui();
    if (s.status) return;
    if (!enabled(state)) { s.status = 'off'; return; }
    s.status = 'loading';
    OB.ai.chatSignals().then(d => { s.status = d && d.near ? 'ok' : 'empty'; s.data = d; rerender(); })
      .catch(e => { s.status = 'error'; s.err = e.message; rerender(); });
  }

  // ---------- B: 추천 패널 아래 섹션 ----------
  function section(state) {
    const s = ui();
    if (!s.status || s.status === 'off') return '';
    let h = '<div class="chat-sec"><div class="rec-head"><h3>💬 총무방 대화</h3><span class="badge demo" title="' + esc(TIP) + '">AI 해석</span></div>';
    if (s.status === 'loading') return h + '<p class="muted small">총무방 대화 집계를 불러오는 중…</p></div>';
    if (s.status !== 'ok') return h + '<p class="muted small">총무방 대화 집계를 불러오지 못했어요. 추천 기능에는 영향이 없어요.</p></div>';
    const d = s.data, n = d.near;
    const item = (id, title, sub) => '<button class="chat-item" data-chat-task="' + id + '"><b>' + esc(title) + '</b><span class="small muted">' + esc(sub) + '</span></button>';
    const block = (label, list) => list.length ? '<div class="chat-block"><div class="chat-label">' + label + '</div>' + list.join('') + '</div>' : '';
    const seasons = n.seasons.slice(0, 3).map(x => item(x.task_id, (x.rel || x.month + '월') + ' · ' + x.task, '해마다 ' + x.month + '월에 대화가 많았어요 (' + yearsText(x.per_year) + ')'));
    const recent = n.recent_spikes.slice(0, 2).map(x => item(x.task_id, md(x.week_start) + ' 주 · ' + x.task, x.sessions + '건 · 평소의 ' + Math.round(x.ratio) + '배 몰렸어요'));
    const past = n.past_spikes.slice(0, 2).map(x => item(x.task_id, x.year + '년 ' + md(x.week_start) + ' 주 · ' + x.task, x.sessions + '건 · 그때 평소의 ' + Math.round(x.ratio) + '배 몰렸어요'));
    h += block('이 시기에 해마다 나오는 업무', seasons) + block('최근 크게 몰린 업무', recent) + block('예전 이맘때 몰렸던 업무', past);
    if (!seasons.length && !recent.length && !past.length) h += '<p class="muted small">기준일 전후로 뚜렷한 신호가 없어요.</p>';
    h += '<p class="small muted">' + (d.stale_days > 0 ? '대화는 ' + md(d.data_range.last) + '까지 반영돼 있어요. ' : '') + '날짜 일정이 아니라 월·주 단위 참고 정보예요.</p>' +
      '<button class="btn small" data-chat-open>자세히 보기</button></div>';
    return h;
  }

  // ---------- C: 시즌 지도 작은 카드 ----------
  const lvl = (v, mx) => (v <= 0 || mx <= 0 ? 0 : Math.max(1, Math.ceil(5 * v / mx)));
  function card(state) {
    const s = ui();
    if (!s.status || s.status === 'off') return '';
    let h = '<article class="card span6 chatmap"><div class="card-head"><h2>💬 총무방 시즌 지도</h2><span class="badge demo" title="' + esc(TIP) + '">AI 해석</span></div>';
    if (s.status === 'loading') return h + '<p class="muted small">시즌 지도를 불러오는 중…</p></article>';
    if (s.status !== 'ok') return h + '<p class="muted small">시즌 지도를 불러오지 못했어요. 다른 기능에는 영향이 없어요.</p></article>';
    const d = s.data, am = Number(d.as_of.slice(5, 7));
    const near = m => { const dd = (m - am + 12) % 12; return dd <= 1 || dd === 11; };   // 기준일 달 ±1
    h += '<p class="small muted">기준일(' + md(d.as_of) + ') 전후로 대화가 몰리는 업무예요. 진한 칸일수록 그 달에 대화가 많았어요(3년 합계).</p>' +
      '<div class="chat-scroll"><table class="cm"><thead><tr><th></th>' + Array.from({ length: 12 }, (_, i) => '<th class="' + (i + 1 === am ? 'cur' : near(i + 1) ? 'nr' : '') + '">' + (i + 1) + '</th>').join('') + '</tr></thead><tbody>' +
      d.focus.map(f => {
        const mx = Math.max.apply(null, f.by_month);
        return '<tr><th class="nm"><button class="linkbtn" data-chat-task="' + f.task_id + '" title="' + esc(f.task) + ' 자세히 보기">' + esc(f.task) + '</button></th>' +
          f.by_month.map((v, i) => '<td class="l' + lvl(v, mx) + (i + 1 === am ? ' cur' : '') + '" title="' + esc(f.task + ' · ' + (i + 1) + '월 ' + v + '건') + '"></td>').join('') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="row gap-s wrap"><button class="btn small primary" data-chat-open>전체 시즌 지도 보기</button></div>' +
      '<p class="small muted">건 = 30분 안에 이어진 대화 한 덩어리 · 대화 자료 ' + d.data_range.first + ' ~ ' + d.data_range.last + '</p></article>';
    return h;
  }

  // ---------- 큰 팝업 ----------
  function nearShare(t, am, months) {
    const w = [(am + 10) % 12, am - 1, am % 12];
    let n = 0;
    months.forEach(ym => { if (w.includes(Number(ym.slice(5)) - 1)) n += t.m[ym] || 0; });
    return n / (t.total || 1);
  }
  function detailHTML(id) {
    const d = ui().data, f = d.full, t = f.tasks.find(x => x.id === id);
    if (!t) return '';
    const se = f.seasons.filter(x => x.task_id === id), sp = f.spikes.filter(x => x.task_id === id).sort((a, b) => a.week_start.localeCompare(b.week_start));
    return '<b>' + esc(t.name) + '</b> <span class="muted small">3년 합계 ' + t.total + '건</span><ul class="chat-det">' +
      se.map(x => '<li>해마다 ' + x.month + '월 · ' + esc(yearsText(x.per_year)) + ' · 이 업무 대화의 ' + Math.round(x.month_share * 100) + '%가 이 달에 몰렸어요</li>').join('') +
      sp.map(x => '<li>' + esc(x.week_start) + ' 주 · ' + x.sessions + '건 · 평소의 ' + Math.round(x.ratio) + '배</li>').join('') +
      (!se.length && !sp.length ? '<li class="muted">반복 시즌이나 크게 몰린 주로 잡힌 신호는 없어요.</li>' : '') + '</ul>';
  }
  function mapRows() {
    const s = ui(), d = s.data, f = d.full, am = Number(d.as_of.slice(5, 7));
    let list = f.tasks.slice();
    if (s.sort === 'near') list.sort((a, b) => nearShare(b, am, f.months) - nearShare(a, am, f.months) || b.total - a.total);
    return list.map(t => {
      const mx = Math.max.apply(null, f.months.map(ym => t.m[ym] || 0));
      return '<tr data-name="' + esc(t.name) + '"><th class="nm"><button class="linkbtn" data-row="' + t.id + '">' + esc(t.name) + '</button><span class="muted small"> ' + t.total + '</span></th>' +
        f.months.map(ym => { const v = t.m[ym] || 0; return '<td class="l' + lvl(v, mx) + (Number(ym.slice(5)) === am ? ' cur' : '') + '" title="' + esc(t.name + ' · ' + ym + ' · ' + v + '건') + '"></td>'; }).join('') + '</tr>' +
        (s.open === t.id ? '<tr class="det"><td colspan="' + (f.months.length + 1) + '">' + detailHTML(t.id) + '</td></tr>' : '');
    }).join('');
  }
  function bodyHTML() {
    const s = ui(), d = s.data, f = d.full, am = Number(d.as_of.slice(5, 7));
    const tabs = [['map', '시즌 지도'], ['season', '해마다 반복되는 달'], ['spike', '크게 몰린 주']];
    let h = '<div class="chat-note">' + esc(d.caution) + '<br><span class="muted">대화 자료 ' + d.data_range.first + ' ~ ' + d.data_range.last +
      (d.stale_days > 0 ? ' (기준일 ' + md(d.as_of) + ' 보다 ' + d.stale_days + '일 앞선 자료)' : '') + ' · 건 = ' + esc(d.unit) + '</span></div>' +
      '<div class="tabs chat-tabs">' + tabs.map(([k, l]) => '<button class="' + (s.tab === k ? 'on' : '') + '" data-ctab="' + k + '">' + l + '</button>').join('') + '</div>';
    if (s.tab === 'map') {
      const yrs = {}; f.months.forEach(ym => { yrs[ym.slice(0, 4)] = (yrs[ym.slice(0, 4)] || 0) + 1; });
      h += '<div class="row gap-s wrap"><input id="chatQ" type="search" placeholder="업무명 검색" value="' + esc(s.q) + '" style="max-width:220px">' +
        '<button class="btn small ' + (s.sort === 'total' ? 'primary' : '') + '" data-csort="total">대화 많은 순</button><button class="btn small ' + (s.sort === 'near' ? 'primary' : '') + '" data-csort="near">이 시기 순</button>' +
        '<span class="small muted">업무명 옆 숫자 = 3년 합계 · 칸을 가리키면 건수 · 업무명을 누르면 자세히</span></div>' +
        '<div class="chat-scroll tall"><table class="cm big"><thead><tr><th></th>' + Object.keys(yrs).map(y => '<th colspan="' + yrs[y] + '" class="yr">' + y + '</th>').join('') + '</tr><tr><th></th>' +
        f.months.map(ym => '<th class="' + (Number(ym.slice(5)) === am ? 'cur' : '') + '">' + Number(ym.slice(5)) + '</th>').join('') + '</tr></thead><tbody id="chatMapBody">' + mapRows() + '</tbody></table></div>';
    } else if (s.tab === 'season') {
      const order = f.seasons.slice().sort((a, b) => ((a.month - am + 12) % 12) - ((b.month - am + 12) % 12) || b.task_total - a.task_total);
      h += '<p class="small muted">같은 달에 2개 연도 이상 각 3건 이상 나오고, 그 달이 업무 전체 대화의 22% 이상인 업무예요. 이번 달부터 순서대로 보여드려요.</p><ul class="chat-list">' +
        order.map(x => '<li><button class="linkbtn" data-row="' + x.task_id + '"><b>' + x.month + '월</b> · ' + esc(x.task) + '</button><span class="small muted">' + esc(yearsText(x.per_year)) + ' · 이 업무 대화의 ' + Math.round(x.month_share * 100) + '%</span></li>').join('') + '</ul>';
    } else {
      h += '<p class="small muted">한 주에 5건 이상, 평소(나머지 주 평균)의 4배 이상 몰린 주예요. 최근 순이에요. 건수가 적은 업무는 배수가 크게 나올 수 있어요.</p><ul class="chat-list">' +
        f.spikes.slice().sort((a, b) => b.week_start.localeCompare(a.week_start)).map(x => '<li><button class="linkbtn" data-row="' + x.task_id + '"><b>' + esc(x.week_start) + ' 주</b> · ' + esc(x.task) + '</button><span class="small muted">' + x.sessions + '건 · 평소의 ' + Math.round(x.ratio) + '배 · 이 업무 3년 합계 ' + x.task_total + '건</span></li>').join('') + '</ul>';
    }
    return h;
  }
  function open(taskId) {
    const s = ui();
    if (s.status !== 'ok') return;
    if (taskId) { s.tab = 'map'; s.q = ''; s.open = taskId; }
    const dlg = OB.app.modal('💬 총무방 시즌 지도 · AI 해석', bodyHTML(), d => {
      d.style.width = 'min(1040px, calc(100vw - 32px))';
      d.onclick = e => {
        let b;
        if ((b = e.target.closest('[data-ctab]'))) { s.tab = b.dataset.ctab; open(); return; }
        if ((b = e.target.closest('[data-csort]'))) { s.sort = b.dataset.csort; open(); return; }
        if ((b = e.target.closest('[data-row]'))) { const id = Number(b.dataset.row); s.open = s.open === id && s.tab === 'map' ? null : id; s.tab = 'map'; s.q = ''; open(); return; }
      };
      const q = d.querySelector('#chatQ');
      if (q) q.oninput = () => {
        s.q = q.value.trim();
        d.querySelectorAll('#chatMapBody tr[data-name]').forEach(tr => { const hit = !s.q || tr.dataset.name.includes(s.q); tr.style.display = hit ? '' : 'none'; if (tr.nextElementSibling && tr.nextElementSibling.classList.contains('det')) tr.nextElementSibling.style.display = hit ? '' : 'none'; });
      };
      if (s.q && q) q.oninput();
      const det = d.querySelector('tr.det');
      if (det && taskId) setTimeout(() => det.scrollIntoView({ block: 'center' }), 30);
    });
    return dlg;
  }

  function click(e) {
    let b;
    if ((b = e.target.closest('[data-chat-task]'))) { open(Number(b.dataset.chatTask)); return true; }
    if (e.target.closest('[data-chat-open]')) { open(); return true; }
    return false;
  }

  OB.chat = { load, section, card, open, click };
})();
