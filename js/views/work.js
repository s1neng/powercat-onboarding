// WORK: 업무 이수율, 캘린더(주·월·연 / 직접추가 / AI추천 / 캡처 반영), 인수인계, 업무검증, 담당자 추천, 메일·공문 초안
(function () {
  const K = OB.core, D = OB.data, esc = K.esc;
  // 이 화면의 팝업. wide 면 근거 설명용으로 넓게 연다.
  const modal = (title, html, mount, wide) => OB.app.modal(title, html, dlg => { dlg.style.width = wide ? 'min(780px, calc(100vw - 32px))' : ''; if (mount) mount(dlg); });

  function ui() {
    const u = OB.app.ui;
    if (!u.work) u.work = {
      view: 'month', cursor: K.todayISO(),
      verifyText: '', verifyResult: null,
      draft: { kind: 'mail', purpose: '협조 요청', to: '', topic: '', points: '', ref: '', attach: '' }, draftOut: null
    };
    return u.work;
  }

  // ---------- 캘린더 ----------
  function allEvents(state) {
    const fixed = [];
    K.courses(state).forEach(c => { if (!c.doneAt) fixed.push({ id: 'c-' + c.id, date: c.deadline, time: '', title: c.name + ' 마감', kind: 'edu', fixed: true }); });
    const d = K.dday(state);
    fixed.push({ id: 'target', date: d.target, time: '', title: '온보딩 목표일', kind: 'goal', fixed: true });
    const ghosts = visibleRec(state).map(r => ({ id: 'rec:' + r.id, date: r.date, time: '', title: r.title, kind: 'ghost', fixed: true }));
    return state.events.map(e => Object.assign({ kind: e.ai ? 'ai' : 'mine' }, e)).concat(fixed, ghosts)
      .sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
  }
  const byDate = evs => evs.reduce((m, e) => ((m[e.date] = m[e.date] || []).push(e), m), {});
  const chip = (e, full) => '<span class="ev ' + e.kind + (e.done ? ' done' : '') + '" data-ev="' + esc(e.id) + '" title="' + esc((e.kind === 'ghost' ? 'AI 추천(예상) — 눌러서 오른쪽 카드 보기: ' : '') + (e.time ? e.time + (e.endTime ? '~' + e.endTime : '') + ' ' : '') + e.title + (e.place ? ' @' + e.place : '') + (e.memo ? ' — ' + e.memo : '')) + '">' +
    (e.done ? '✓ ' : '') + (e.kind === 'ai' || e.kind === 'ghost' ? '✨ ' : '') + (e.time ? '<em>' + e.time + (full && e.endTime ? '~' + e.endTime : '') + '</em>' : '') + esc(e.title) + (full && e.place ? ' <small>@' + esc(e.place) + '</small>' : '') + (e.memo ? ' 📝' : '') + '</span>';

  function calTitle(s) {
    const c = K.parseISO(s.cursor);
    if (s.view === 'year') return c.getFullYear() + '년';
    if (s.view === 'month') return c.getFullYear() + '년 ' + (c.getMonth() + 1) + '월';
    const start = weekStart(s.cursor);
    return K.fmtDate(start) + ' ~ ' + K.fmtDate(K.addDays(start, 6));
  }
  const weekStart = iso => K.addDays(iso, -K.parseISO(iso).getDay());

  function monthGrid(cursor, map, today) {
    const c = K.parseISO(cursor), y = c.getFullYear(), m = c.getMonth();
    const first = K.toISO(new Date(y, m, 1));
    const start = weekStart(first);
    const weeks = Math.ceil((K.parseISO(first).getDay() + new Date(y, m + 1, 0).getDate()) / 7);
    let h = '<div class="month">' + K.WEEK.map((w, i) => '<div class="dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') + '">' + w + '</div>').join('');
    for (let i = 0; i < weeks * 7; i++) {
      const iso = K.addDays(start, i), d = K.parseISO(iso), evs = map[iso] || [];
      h += '<div class="day' + (d.getMonth() !== m ? ' out' : '') + (iso === today ? ' today' : '') + '" data-day="' + iso + '">' +
        '<span class="dnum">' + d.getDate() + '</span>' + evs.slice(0, 4).map(chip).join('') +
        (evs.length > 4 ? '<span class="more">+' + (evs.length - 4) + '</span>' : '') + '</div>';
    }
    return h + '</div>';
  }
  function weekGrid(cursor, map, today) {
    const start = weekStart(cursor);
    let h = '<div class="week">';
    for (let i = 0; i < 7; i++) {
      const iso = K.addDays(start, i), evs = map[iso] || [];
      h += '<div class="wday' + (iso === today ? ' today' : '') + '" data-day="' + iso + '"><div class="wday-head"><b>' + K.WEEK[i] + '</b> ' + K.parseISO(iso).getDate() + '</div>' +
        (evs.length ? evs.map(x => chip(x, true)).join('') : '<span class="muted small">일정 없음</span>') + '</div>';
    }
    return h + '</div>';
  }
  function yearGrid(cursor, evs) {
    const y = K.parseISO(cursor).getFullYear();
    let h = '<div class="year">';
    for (let m = 0; m < 12; m++) {
      const prefix = y + '-' + String(m + 1).padStart(2, '0');
      const list = evs.filter(e => e.date.startsWith(prefix) && e.kind !== 'ghost');
      const days = new Set(list.map(e => +e.date.slice(8)));
      const ghost = evs.filter(e => e.date.startsWith(prefix) && e.kind === 'ghost'), gdays = new Set(ghost.map(e => +e.date.slice(8)));
      const firstDow = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate();
      let cells = '';
      for (let i = 0; i < firstDow; i++) cells += '<i></i>';
      for (let d = 1; d <= n; d++) cells += '<i class="' + (days.has(d) ? 'has' : gdays.has(d) ? 'gh' : '') + '">' + d + '</i>';
      h += '<button class="mini" data-month="' + prefix + '-01"><b>' + (m + 1) + '월</b><span class="muted small">' + list.length + '건' + (ghost.length ? ' · <span class="gtxt">✨추천 ' + ghost.length + '</span>' : '') + '</span><div class="mini-grid">' + cells + '</div></button>';
    }
    return h + '</div>';
  }

  // ---------- AI 추천 패널 (캘린더 옆) ----------
  const isLiveJob = state => OB.ai.preLive() && state.user.job === OB.config.RECOMMEND_JOB;
  const shortDate = iso => { const d = K.parseISO(iso); return (d.getMonth() + 1) + '/' + d.getDate() + '(' + K.WEEK[d.getDay()] + ')'; };
  function loadRec(state) {
    const s = ui();
    if (s.rec) return;
    const done = patch => { s.rec = Object.assign({ status: 'ok', ignored: [], items: [], base: K.todayISO() }, patch); if (location.hash === '#/work') OB.app.render(); };
    const sample = (note, warn) => done({ demo: 'sample', note, warn, items: OB.ai.recommend(state).map(r => ({ id: r.id, date: r.date, time: '', title: r.title, why: r.why, label: '샘플' })) });
    if (!isLiveJob(state)) { s.rec = { status: 'ok', ignored: [], items: [], base: K.todayISO() }; sample('사무(경영지원) 외 직무는 예시 데이터예요.'); return; }
    s.rec = { status: 'loading', ignored: [], items: [], base: K.todayISO() };
    OB.ai.recommendPre(state).then(out => {
      if (out.unsupported || !out.items.length) sample('이 기준일에 불러올 사전 생성 추천이 없어 예시를 보여드려요.', '불러올 사전 생성 추천이 없어 예시를 보여드려요.');
      else done({ demo: 'pre', generated: out.generated, base: (out.generated && out.generated.requested_as_of) || K.todayISO(), items: out.items });
    }).catch(err => sample('추천 서버에 연결하지 못해 예시를 보여드려요.', '추천 서버에 연결하지 못해 예시를 보여드려요. (' + err.message + ')'));
  }
  function visibleRec(state) {
    const r = ui().rec;
    if (!r || r.status !== 'ok') return [];
    const have = new Set(state.events.map(e => e.date + e.title));
    return r.items.filter(i => !r.ignored.includes(i.id) && !have.has(i.date + i.title));
  }
  function recWhen(it, base) {
    if (it.ongoing && it.range) return '지금 ~ ' + shortDate(it.range[1]) + ' · 진행 중일 수 있음';
    const n = K.diffDays(base, it.date);
    return shortDate(it.date) + ' · ' + (n <= 0 ? '오늘' : n + '일 뒤');
  }
  function recPanel(state) {
    const r = ui().rec;
    let h = '<aside class="rec-panel" id="recPanel"><div class="rec-head"><h3>✨ AI 추천 일정</h3>';
    if (!r || r.status === 'loading') return h + '</div><p class="muted small">공문 기록에서 추천을 불러오는 중…</p></aside>';
    const pre = r.demo === 'pre', g = r.generated || {};
    const tip = pre ? '실시간 AI 호출이 아니라, 과거 공문 DB로 AI가 미리 만들고 코드로 검증해 저장한 결과예요. 모두 예상 일정이며 확정이 아니에요.' +
      ' (기준일 ' + (g.as_of || '') + ' · ' + (g.model || '') + ' · 근거 검증 ' + (g.verification ? g.verification.passed + '/' + g.verification.total : '') + ')' : r.note || '예시 데이터예요.';
    h += '<span class="badge demo" title="' + esc(tip) + '">' + (pre ? '시연용 사전 생성 결과' : '시연용 샘플') + '</span></div>';
    if (r.warn) h += '<p class="muted small">' + esc(r.warn) + '</p>';   // 서버 연결 실패 등 사용자가 알아야 할 때만
    const list = visibleRec(state);
    if (!list.length) h += '<div class="empty small"><p>지금 보여드릴 추천이 없어요.</p></div>';
    h += list.map(it => '<div class="rec-card" data-rec-card="' + esc(it.id) + '">' +
      '<div class="rec-top"><button class="rec-title" data-rec-go="' + esc(it.id) + '" title="캘린더에서 이 날짜 보기">' + esc(it.title) + '</button><span class="badge">' + esc(it.label || '예상') + '</span></div>' +
      '<div class="rec-when">' + esc(recWhen(it, r.base)) + '</div>' +
      '<p class="small">' + esc(it.why || '') + '</p>' +
      '<div class="row gap-s wrap"><button class="btn small primary" data-rec-add="' + esc(it.id) + '">캘린더에 등록</button>' + (it.evidence && it.evidence.length ? '<button class="btn small" data-rec-detail="' + esc(it.id) + '">자세히 보기</button>' : '') + '<button class="btn small ghost" data-rec-ignore="' + esc(it.id) + '">무시</button></div></div>').join('');
    if (r.ignored.length) h += '<button class="btn small ghost" data-rec-reset>무시한 추천 ' + r.ignored.length + '개 다시 보기</button>';
    return h + '</aside>';
  }
  const aiSnapshot = it => ({ why: it.why, basis: it.basis || '', range: it.range || null, evidence: it.evidence || [], label: it.label || '예상', series_id: it.series_id || null,
    predicted: it.predicted || it.date, ongoing: !!it.ongoing, support_years: it.support_years || [], n_docs: it.n_docs || 0, avg_lead_days: it.avg_lead_days == null ? null : it.avg_lead_days,
    origDate: it.date, origTitle: it.title });
  function recAdd(id) {
    const it = ui().rec.items.find(x => x.id === id);
    if (!it) return;
    OB.app.update(st => st.events.push({ id: K.uid(), date: it.date, time: '', title: it.title, source: it.label === '샘플' ? 'AI 추천' : 'AI 추천 (공문 기반)', ai: aiSnapshot(it) }));
    if (it.series_id) OB.ai.sendFeedback([{ series_id: it.series_id, action: 'register' }]);
    OB.app.toast('캘린더에 등록했어요');
  }
  function focusRec(id) {
    const el = document.querySelector('[data-rec-card="' + id + '"]');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600);
  }

  // ---------- 화면 ----------
  function render(state) {
    const s = ui(), p = K.progress(state), items = K.workItems(state);
    const ho = items.filter(i => i.kind === '인수인계'), missions = items.filter(i => i.kind === '미션');
    const evs = allEvents(state), map = byDate(evs), today = K.todayISO();
    const cal = s.view === 'month' ? monthGrid(s.cursor, map, today) : s.view === 'week' ? weekGrid(s.cursor, map, today) : yearGrid(s.cursor, evs);
    const u = state.user;
    const people = D.PEOPLE.filter(x => x.job === u.job).sort((a, b) => (b.hq === u.hq) - (a.hq === u.hq) || b.years - a.years);
    const dr = s.draft;

    return OB.app.header('업무', p.work, 'work') +
      '<section class="missions">' +
        '<div class="mission ' + (ho.every(i => i.done) ? 'done' : '') + '"><span>' + (ho.every(i => i.done) ? '✅' : '📋') + '</span>인수인계 ' + ho.filter(i => i.done).length + '/' + ho.length + '</div>' +
        missions.map(m => '<div class="mission ' + (m.done ? 'done' : '') + '"><span>' + (m.done ? '✅' : '○') + '</span>' + esc(m.label) + '</div>').join('') +
      '</section>' +
      '<section class="grid">' +
        '<article class="card span12 calendar">' +
          '<div class="card-head wrap"><h2>캘린더</h2>' +
            '<div class="tabs" role="tablist">' + [['week', '주간'], ['month', '월간'], ['year', '연간']].map(([k, l]) => '<button role="tab" aria-selected="' + (s.view === k) + '" class="' + (s.view === k ? 'on' : '') + '" data-view="' + k + '">' + l + '</button>').join('') + '</div>' +
          '</div>' +
          '<div class="cal-bar"><div class="row"><button class="btn ghost icon" data-nav="-1" aria-label="이전">‹</button><b class="cal-title">' + calTitle(s) + '</b><button class="btn ghost icon" data-nav="1" aria-label="다음">›</button><button class="btn ghost small" data-nav="0">오늘</button></div>' +
            '<div class="row gap-s"><button class="btn small" data-act="add">+ 일정</button><button class="btn small ai" data-act="recommend">✨ 추천 새로고침</button><button class="btn small ai" data-act="capture">📷 메일·쪽지 반영</button></div></div>' +
          '<div class="cal-wrap"><div class="cal-main">' + cal +
          '<div class="legend small muted"><span class="ev mine">내 일정</span><span class="ev edu">교육 마감</span><span class="ev goal">온보딩 목표일</span><span class="ev ai">✨ 등록한 AI 추천</span><span class="ev ghost">✨ AI 추천(예상·미등록)</span></div></div>' +
          recPanel(state) + '</div>' +
        '</article>' +
        '<article class="card span6 handover">' +
          '<div class="card-head"><h2>인수인계</h2><span class="muted small">' + ho.filter(i => i.done).length + '/' + ho.length + '</span></div>' +
          '<ul class="checklist">' + ho.map(i => '<li><label><input type="checkbox" data-ho="' + i.id.slice(3) + '"' + (i.done ? ' checked' : '') + '><span>' + esc(i.label) + '</span></label></li>').join('') + '</ul>' +
          '<label class="small muted">인수인계 메모<textarea id="hoMemo" rows="4" placeholder="전임자 연락처, 주의사항 등">' + esc(state.work.memo) + '</textarea></label>' +
        '</article>' +
        '<article class="card span12 verify">' +
          '<div class="card-head"><h2>업무검증</h2><span class="muted small">규정 · 지침 · 매뉴얼 참고</span></div>' +
          '<textarea id="verifyText" rows="3" placeholder="처리하려는 업무를 적어 주세요. 예) 협력업체와 점심 식사 후 계약 견적 받기">' + esc(s.verifyText) + '</textarea>' +
          '<div class="row wrap gap-s examples">' + ['출장 숙박비 정산', '물품 구매 견적 1개로 계약', '고객 연락처 명단 외부 메일 전송', '정전 작업 현장 투입'].map(x => '<button class="chip btnlike" data-ex="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>' +
          '<button class="btn primary" data-act="verify">검증하기</button>' +
          '<div id="verifyOut">' + verifyResult(s) + '</div>' +
        '</article>' +
        '<article class="card span6 people">' +
          '<div class="card-head"><h2>동일분야 담당자 추천</h2><span class="muted small">' + esc(u.job) + '</span></div>' +
          '<ul class="person-list">' + people.map(x => {
            const on = state.work.connected.includes(x.id);
            return '<li><span class="avatar">' + esc(x.name.slice(0, 1)) + '</span><div><b>' + esc(x.name) + '</b> <span class="muted small">' + x.years + '년차</span>' +
              (x.hq === u.hq ? ' <span class="tag">같은 본부</span>' : '') +
              '<div class="small muted">' + esc(x.hq) + ' ' + esc(x.office) + ' · ' + esc(x.topic) + '</div></div>' +
              '<button class="btn small ' + (on ? 'ghost' : '') + '" data-connect="' + x.id + '"' + (on ? ' disabled' : '') + '>' + (on ? '연결됨 ✓' : '연결 요청') + '</button></li>';
          }).join('') + '</ul>' +
          '<p class="small muted">개인정보 보호를 위해 연락처는 표시하지 않고, 연결 요청은 사내 쪽지로 전달됩니다.</p>' +
        '</article>' +
        '<article class="card span12 draft">' +
          '<div class="card-head"><h2>메일 · 공문 초안 AI</h2>' + aiBadge() + '</div>' +
          '<div class="draft-grid">' +
            '<form id="draftForm" class="stack">' +
              '<div class="tabs">' + [['mail', '업무 메일'], ['doc', '공문']].map(([k, l]) => '<button type="button" class="' + (dr.kind === k ? 'on' : '') + '" data-kind="' + k + '">' + l + '</button>').join('') + '</div>' +
              '<div class="row gap-s"><label class="grow">목적<select name="purpose">' + OB.ai.PURPOSES.map(x => '<option' + (dr.purpose === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label>' +
              '<label class="grow">수신<input name="to" value="' + esc(dr.to) + '" placeholder="예) 영업부장, 김OO 차장"></label></div>' +
              '<label>제목<input name="topic" value="' + esc(dr.topic) + '" placeholder="예) 11월 고객만족도 조사 자료 제출"></label>' +
              '<label>핵심 내용 (한 줄에 하나씩)<textarea name="points" rows="4" placeholder="제출 기한: 11월 10일&#10;제출 양식: 붙임 참조">' + esc(dr.points) + '</textarea></label>' +
              (dr.kind === 'doc' ? '<div class="row gap-s"><label class="grow">관련 문서<input name="ref" value="' + esc(dr.ref) + '" placeholder="예) 영업부-1234(2026.10.1.)"></label><label class="grow">붙임<input name="attach" value="' + esc(dr.attach) + '" placeholder="예) 제출 양식 1부"></label></div>' : '') +
              '<button class="btn primary">초안 작성</button>' +
            '</form>' +
            '<div class="draft-out">' + (s.draftOut ?
              '<textarea id="draftText" rows="16">' + esc(s.draftOut.text) + '</textarea><div class="row gap-s"><button class="btn" data-act="copy">복사</button>' + (s.draftOut.demo ? '<span class="small muted">서식 기반 시연 초안 — 사내 AI 연결 시 문장이 다듬어집니다</span>' : '') + '</div>' :
              '<div class="empty"><p>왼쪽에 내용을 입력하고 <b>초안 작성</b>을 누르면<br>여기에 초안이 나타나요. 보내기 전에 꼭 검토하세요.</p></div>') + '</div>' +
          '</div>' +
        '</article>' +
      '</section>';
  }

  const aiBadge = () => '<span class="badge ' + (OB.ai.live() ? 'live' : '') + '">' + (OB.ai.live() ? '사내 AI 연결됨' : '시연 모드 · 외부 전송 없음') + '</span>';

  function verifyResult(s) {
    const r = s.verifyResult;
    if (!r) return '';
    if (r === 'loading') return '<p class="muted">규정·지침을 찾는 중…</p>';
    if (!r.length) return '<div class="result none">관련 조항을 찾지 못했어요. 사수나 팀장님께 확인하거나 <b>동일분야 담당자</b>에게 물어보세요.</div>';
    return r.map(x => '<div class="result"><div class="row between"><b>' + esc(x.source) + ' ' + esc(x.article) + '</b><span class="small muted">관련어: ' + x.hits.map(esc).join(', ') + '</span></div>' +
      '<p>' + esc(x.text) + '</p><ul class="checks">' + x.checks.map(c => '<li>☐ ' + esc(c) + '</li>').join('') + '</ul></div>').join('') +
      '<p class="small muted">참고용 안내입니다. 최종 판단은 규정 원문과 결재권자 확인을 따르세요.</p>';
  }

  // ---------- 추천 근거 설명 팝업 ----------
  const mdText = iso => { const d = K.parseISO(iso); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; };
  const ROLE_TXT = { '시행일': '시행', '제출기한': '제출 마감' };
  // 과거 날짜를 올해 범위(lo~hi)와 같은 해로 옮겨 막대 위 위치(0~1)를 구한다
  function barPos(iso, lo, hi) {
    const d = K.parseISO(iso), base = K.parseISO(lo).getFullYear(), span = Math.max(K.diffDays(lo, hi), 1);
    let best = null;
    [base - 1, base, base + 1].forEach(y => {
      const off = K.diffDays(lo, K.toISO(new Date(y, d.getMonth(), d.getDate())));
      if (best === null || Math.abs(off - span / 2) < Math.abs(best - span / 2)) best = off;
    });
    return Math.min(1, Math.max(0, best / span));
  }
  function explainHTML(a, title) {
    const ev = a.evidence || [], yrs = a.support_years || [], lo = a.range && a.range[0], hi = a.range && a.range[1];
    const when = !lo ? '' : lo === hi ? mdText(lo) : mdText(lo) + ' ~ ' + mdText(hi);
    const years = [...new Set(ev.map(x => x.date.slice(0, 4)))].sort();
    let h = '<div class="ex-sum"><span class="badge demo">AI 추천 · ' + esc(a.label || '예상') + '</span> <b>' + esc(a.why || '') + '</b></div>';
    h += '<h4>1. 어떤 근거로 추천했나요?</h4>';
    h += '<p>과거 <b>' + esc((yrs.length ? yrs : years).join('·')) + '년</b> 천안지사 공문 <b>' + (a.n_docs || ev.length) + '건</b>에서, 「' + esc(title) + '」 업무가 해마다 ' + (when ? '<b>' + esc(when) + '</b> 즈음에' : '비슷한 시기에') + ' 있었어요. ' +
      '같은 시기가 <b>서로 다른 ' + (yrs.length || years.length) + '개 연도</b>에서 반복돼서 올해도 비슷할 것으로 <b>예상</b>했어요.</p>';
    if (lo && ev.length) {
      h += '<div class="ex-chart" aria-label="연도별 과거 일정 위치"><div class="ex-axis small muted"><span>' + esc(mdText(lo)) + '</span><span>' + esc(mdText(hi)) + '</span></div>';
      years.forEach(y => {
        const list = ev.filter(x => x.date.startsWith(y));
        h += '<div class="ex-row"><span class="ex-year">' + y + '</span><div class="ex-track">' +
          list.map(x => '<i class="ex-dot" style="left:' + (6 + barPos(x.date, lo, hi) * 88).toFixed(1) + '%" title="' + esc(x.date + ' ' + (ROLE_TXT[x.role] || '')) + '"></i>').join('') + '</div>' +
          '<span class="ex-dates small muted">' + [...new Set(list.map(x => K.parseISO(x.date).getMonth() + 1 + '/' + K.parseISO(x.date).getDate()))].join(', ') + '</span></div>';
      });
      if (a.predicted) h += '<div class="ex-row"><span class="ex-year">올해</span><div class="ex-track pred"><i class="ex-dot pred" style="left:' + (6 + barPos(a.predicted, lo, hi) * 88).toFixed(1) + '%"></i></div><span class="ex-dates small"><b>예상 ' + esc(mdText(a.predicted)) + '</b></span></div>';
      h += '</div>';
    }
    h += '<h4>2. 근거가 된 공문</h4><ul class="ex-docs">' + ev.map(x =>
      '<li><div><b>' + esc(x.date) + '</b> <span class="badge">' + esc(ROLE_TXT[x.role] || '일정') + '</span> <span class="muted small">' + esc(x.doc_no) + (x.registered_at ? ' · 공문 등록 ' + esc(x.registered_at) : '') + '</span></div>' +
      '<div>' + esc(x.title) + '</div>' + (x.summary ? '<div class="small muted">' + esc(x.summary) + '</div>' : '') + '</li>').join('') + '</ul>';
    const acts = [...new Set(ev.map(x => x.worker_action).filter(x => x && x !== '참고' && x !== '기타'))];
    h += '<h4>3. 담당자가 할 일</h4><p>' + (acts.length ? '근거 공문에서는 주로 <b>' + acts.map(esc).join(', ') + '</b>이(가) 필요했어요. 위 공문 요약을 참고해 준비하세요.' : '근거 공문은 대부분 참고용 안내였어요.') + '</p>';
    if (a.avg_lead_days != null) {
      const n = Math.round(a.avg_lead_days);
      h += '<h4>4. 공문은 언제 오나요?</h4><p>' + (n < 2 ? '과거 공문은 일정과 <b>거의 같은 날</b> 등록됐어요. 미리 알려 주지 않고 갑자기 올 수 있으니 이 시기에는 공문함을 자주 확인하세요.' : '과거에는 일정 <b>약 ' + n + '일 전</b>에 공문이 등록됐어요.') + '</p>';
    }
    const last = [...(yrs.length ? yrs : years)].sort().pop();
    h += '<h4>' + (a.avg_lead_days != null ? '5' : '4') + '. 알아둘 점</h4><ul class="ex-notes small"><li>이 일정은 <b>확정이 아닌 예상</b>이에요. 올해 일정은 실제 공문·공지로 꼭 확인하세요.</li>' +
      (last ? '<li>가장 최근 근거는 ' + esc(last) + '년 공문이에요. 그 이후 변경은 반영되지 않았어요.</li>' : '') +
      '<li>근거 공문을 고르고 날짜를 계산한 것은 <b>코드</b>이고, 이 설명 문장은 AI가 근거 안의 사실만 써서 만들었으며 코드로 한 번 더 검증했어요.</li></ul>';
    return h;
  }
  function explainModal(a, title, opts) {
    opts = opts || {};
    modal(title + ' — 추천 근거', explainHTML(a, title) + '<div class="row gap-s">' +
      (opts.add ? '<button class="btn primary" id="exAdd">캘린더에 등록</button>' : '') + (opts.back ? '<button class="btn" id="exBack">← 일정으로 돌아가기</button>' : '') + '<button class="btn ghost" id="exClose">닫기</button></div>', dlg => {
      const q = id => dlg.querySelector(id);
      if (q('#exAdd')) q('#exAdd').onclick = () => { OB.app.closeModal(); opts.add(); };
      if (q('#exBack')) q('#exBack').onclick = opts.back;
      q('#exClose').onclick = () => OB.app.closeModal();
    }, true);
  }

  // ---------- 모달: 일정 추가 / 상세·수정 ----------
  const timeFields = e => '<div class="row gap-s"><label class="grow">날짜<input type="date" name="date" required value="' + e.date + '"></label>' +
    '<label class="grow">시작<input type="time" name="time" value="' + esc(e.time || '') + '"></label><label class="grow">종료<input type="time" name="endTime" value="' + esc(e.endTime || '') + '"></label></div>';
  function addModal(date) {
    modal('일정 추가', '<form id="evForm" class="stack"><label>제목<input name="title" required maxlength="40" placeholder="예) 팀 주간회의"></label>' +
      timeFields({ date: date || K.todayISO() }) +
      '<label>장소 <span class="muted small">(선택)</span><input name="place" maxlength="40" placeholder="예) 본부 3층 대회의실"></label>' +
      '<label>메모 <span class="muted small">(선택)</span><textarea name="memo" rows="3" maxlength="500" placeholder="준비물, 참고사항 등"></textarea></label>' +
      '<button class="btn primary">추가</button></form>', dlg => {
      const f = dlg.querySelector('#evForm').elements;
      f.title.focus();
      dlg.querySelector('#evForm').onsubmit = e => {
        e.preventDefault();
        const t = f.title.value.trim();
        if (!t || !K.isValidISO(f.date.value)) return;
        if (f.time.value && f.endTime.value && f.endTime.value < f.time.value) { OB.app.toast('종료 시간이 시작보다 빨라요'); return; }
        OB.app.update(st => st.events.push({ id: K.uid(), date: f.date.value, time: f.time.value, endTime: f.endTime.value, title: t, place: f.place.value.trim(), memo: f.memo.value.trim(), source: '직접' }));
        OB.app.closeModal();
        OB.app.toast('일정을 추가했어요');
      };
    });
  }
  function eventModal(id) {
    const e = allEvents(OB.app.state).find(x => x.id === id);
    if (!e) return;
    if (e.fixed) {
      modal(e.title, '<p>' + K.fmtDate(e.date, true) + '</p><p class="muted small">' + (e.kind === 'edu' ? '교육 페이지에서 이수하면 사라져요.' : '관리자가 지정한 온보딩 기간으로 계산된 날짜예요.') + '</p>');
      return;
    }
    const ai = e.ai;
    const changed = ai && (ai.origDate !== e.date || ai.origTitle !== e.title);
    const box = ai ? '<div class="ai-box"><div><span class="badge demo">AI 추천 · ' + esc(ai.label || '예상') + '</span> ' + esc(ai.why || '') + '</div>' +
      (ai.evidence && ai.evidence.length ? '<div class="row gap-s wrap"><button type="button" class="btn small" id="exOpen">왜 추천했나요? 자세히 보기</button></div>' : '') +
      (changed ? '<div class="small muted">AI가 추천한 일정: ' + esc(ai.origTitle) + ' · ' + esc(mdText(ai.origDate)) + ' → 내가 수정했어요</div>' : '') +
      '<div class="small muted">공문 기록으로 계산한 예상이에요. 확정이 아니니 실제 공문·공지로 확인하세요.</div></div>' : '';
    modal(e.title, box + '<form id="evEdit" class="stack"><label>제목<input name="title" required maxlength="40" value="' + esc(e.title) + '"></label>' + timeFields(e) +
      '<label>장소 <span class="muted small">(선택)</span><input name="place" maxlength="40" value="' + esc(e.place || '') + '"></label>' +
      '<label>내 메모 <span class="muted small">(나만 보는 메모)</span><textarea name="memo" rows="4" maxlength="500" placeholder="준비물, 담당자 연락, 진행 상황 등">' + esc(e.memo || '') + '</textarea></label>' +
      '<label class="check"><input type="checkbox" name="done"' + (e.done ? ' checked' : '') + '> 완료했어요</label>' +
      '<p class="muted small">등록 경로: ' + esc(e.source || '직접') + '</p>' +
      '<div class="row between"><button type="button" class="btn danger" id="delEv">삭제</button><button class="btn primary">저장</button></div></form>', dlg => {
      const f = dlg.querySelector('#evEdit').elements;
      const ex = dlg.querySelector('#exOpen');
      if (ex) ex.onclick = () => explainModal(ai, ai.origTitle || e.title, { back: () => eventModal(id) });
      dlg.querySelector('#delEv').onclick = () => { if (!confirm('이 일정을 삭제할까요?')) return; OB.app.update(st => { st.events = st.events.filter(x => x.id !== id); }); OB.app.closeModal(); OB.app.toast('일정을 삭제했어요'); };
      dlg.querySelector('#evEdit').onsubmit = ev => {
        ev.preventDefault();
        const t = f.title.value.trim();
        if (!t || !K.isValidISO(f.date.value)) { OB.app.toast('제목과 날짜를 확인해 주세요'); return; }
        if (f.time.value && f.endTime.value && f.endTime.value < f.time.value) { OB.app.toast('종료 시간이 시작보다 빨라요'); return; }
        OB.app.update(st => {
          const x = st.events.find(y => y.id === id);
          if (x) Object.assign(x, { title: t, date: f.date.value, time: f.time.value, endTime: f.endTime.value, place: f.place.value.trim(), memo: f.memo.value.trim(), done: f.done.checked });
        });
        OB.app.closeModal();
        OB.app.toast('일정을 저장했어요');
      };
    });
  }
  function candidateList(list, source) {
    if (!list.length) return '<p class="muted">날짜를 찾지 못했어요. 날짜(예: 11월 3일, 2026.11.03, 내일)가 들어 있는지 확인해 주세요.</p>';
    return '<form id="candForm" class="stack"><ul class="cands">' + list.map((c, i) =>
      '<li><input type="checkbox" name="pick" value="' + i + '" checked aria-label="선택">' +
      '<input name="t' + i + '" value="' + esc(c.title) + '" aria-label="제목"><input type="date" name="d' + i + '" value="' + c.date + '" aria-label="날짜"><input type="time" name="h' + i + '" value="' + (c.time || '') + '" aria-label="시간">' +
      (c.why ? '<span class="why small muted">' + esc(c.why) + '</span>' : '') + '</li>').join('') +
      '</ul><button class="btn primary">선택한 일정 캘린더에 등록</button></form>';
  }
  function bindCandidates(dlg, source) {
    const f = dlg.querySelector('#candForm');
    if (!f) return;
    f.onsubmit = e => {
      e.preventDefault();
      const picks = [...f.querySelectorAll('[name=pick]:checked')].map(x => +x.value);
      const add = picks.map(i => ({ id: K.uid(), title: f['t' + i].value.trim() || '새 일정', date: f['d' + i].value, time: f['h' + i].value, source })).filter(x => K.isValidISO(x.date));
      if (!add.length) { OB.app.toast('선택된 일정이 없어요'); return; }
      OB.app.update(st => { st.events.push(...add); });
      OB.app.closeModal();
      OB.app.toast(add.length + '건을 캘린더에 등록했어요');
    };
  }
  function captureModal() {
    modal('📷 메일 · 쪽지 캘린더 반영',
      '<div class="tabs" id="capTabs"><button class="on" data-cap="text">텍스트 붙여넣기</button><button data-cap="image">캡처 이미지</button></div>' +
      '<div id="capText" class="stack"><textarea id="capInput" rows="7" placeholder="메일·쪽지 내용을 붙여넣으세요.&#10;예) 제목: 11월 부서 회의&#10;일시: 11월 3일(화) 오후 2시"></textarea><button class="btn primary" id="capParse">일정 찾기</button></div>' +
      '<div id="capImage" class="stack" hidden><label class="drop">캡처 이미지를 선택하세요 (PNG·JPG)<input type="file" id="capFile" accept="image/*"></label><div id="capPreview"></div>' +
      '<p class="small muted">' + (OB.ai.live() ? '사내 AI로 글자를 읽습니다.' : '시연 모드: 사내 AI(OCR) 연결 전이라 예시 문장으로 읽어요. 이미지는 외부로 전송되지 않습니다.') + '</p></div>' +
      '<div id="capOut"></div>', dlg => {
        const out = dlg.querySelector('#capOut');
        const show = text => { out.innerHTML = '<h3>찾은 일정</h3>' + candidateList(K.parseSchedule(text)); bindCandidates(dlg, '메일·쪽지'); };
        dlg.querySelector('#capTabs').onclick = e => {
          const b = e.target.closest('[data-cap]'); if (!b) return;
          dlg.querySelectorAll('#capTabs button').forEach(x => x.classList.toggle('on', x === b));
          dlg.querySelector('#capText').hidden = b.dataset.cap !== 'text';
          dlg.querySelector('#capImage').hidden = b.dataset.cap !== 'image';
          out.innerHTML = '';
        };
        dlg.querySelector('#capParse').onclick = () => show(dlg.querySelector('#capInput').value);
        dlg.querySelector('#capFile').onchange = async e => {
          const file = e.target.files[0]; if (!file) return;
          const pv = dlg.querySelector('#capPreview');
          pv.innerHTML = '<img class="cap-img" alt="업로드한 캡처" src="' + URL.createObjectURL(file) + '"><p class="muted">글자를 읽는 중…</p>';
          try {
            const r = await OB.ai.ocr(file);
            pv.querySelector('p').outerHTML = '<label class="small muted">읽은 내용 (고칠 수 있어요)' + (r.demo ? ' · <b>시연 응답</b>' : '') + '<textarea id="ocrText" rows="6">' + esc(r.text) + '</textarea></label><button class="btn" id="ocrParse">이 내용으로 다시 찾기</button>';
            dlg.querySelector('#ocrParse').onclick = () => show(dlg.querySelector('#ocrText').value);
            show(r.text);
          } catch (err) {
            pv.querySelector('p').textContent = '읽기에 실패했어요: ' + err.message;
          }
        };
      });
  }

  // ---------- 이벤트 ----------
  // 달력을 해당 날짜로 옮긴다. 기간이 바뀌면 방향에 맞춰 슬며시 밀려 들어오고, 도착한 날짜 칸이 잠깐 빛난다.
  function goTo(s, iso) {
    const from = s.cursor, view = s.view === 'year' ? 'month' : s.view;
    const key = d => (view === 'week' ? weekStart(d) : d.slice(0, 7));
    s.anim = s.view === 'year' ? 'zoom' : key(iso) !== key(from) ? (iso > from ? 'next' : 'prev') : null;
    s.view = view; s.cursor = iso; s.pulse = iso;
    OB.app.render();
    if (window.innerWidth <= 1100) setTimeout(() => { const c = document.querySelector('.cal-main'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 60);
  }
  function mount(root, state) {
    const s = ui();
    loadRec(state);
    if (s.anim || s.pulse) {
      const g = root.querySelector('.month, .week, .year');
      if (g && s.anim) g.classList.add('slide-' + s.anim);
      const ct = root.querySelector('.cal-title');
      if (ct && s.anim) ct.classList.add('title-fade');
      if (s.pulse) root.querySelectorAll('[data-day="' + s.pulse + '"]').forEach(x => x.classList.add('pulse'));
      s.anim = s.pulse = null;
    }
    root.addEventListener('click', async e => {
      const t = e.target;
      let b;
      if ((b = t.closest('[data-ev]'))) { e.stopPropagation(); if (b.dataset.ev.startsWith('rec:')) focusRec(b.dataset.ev.slice(4)); else eventModal(b.dataset.ev); return; }
      if ((b = t.closest('[data-rec-add]'))) { recAdd(b.dataset.recAdd); return; }
      if ((b = t.closest('[data-rec-detail]'))) {
        const it = s.rec.items.find(x => x.id === b.dataset.recDetail);
        if (it) explainModal(aiSnapshot(it), it.title, { add: () => recAdd(it.id) });
        return;
      }
      if ((b = t.closest('[data-rec-ignore]'))) {
        const it = s.rec.items.find(x => x.id === b.dataset.recIgnore);
        s.rec.ignored.push(b.dataset.recIgnore);
        if (it && it.series_id) OB.ai.sendFeedback([{ series_id: it.series_id, action: 'ignore' }]);
        OB.app.render(); return;
      }
      if (t.closest('[data-rec-reset]')) { s.rec.ignored = []; OB.app.render(); return; }
      if ((b = t.closest('[data-rec-go]'))) {
        const it = s.rec.items.find(x => x.id === b.dataset.recGo);
        if (it) goTo(s, it.date);
        return;
      }
      if ((b = t.closest('[data-rec-card]'))) {   // 카드 어디를 눌러도 그 날짜로 이동
        const it = s.rec.items.find(x => x.id === b.dataset.recCard);
        if (it) goTo(s, it.date);
        return;
      }
      if ((b = t.closest('[data-view]'))) { s.view = b.dataset.view; OB.app.render(); return; }
      if ((b = t.closest('[data-nav]'))) {
        const n = +b.dataset.nav, c = K.parseISO(s.cursor);
        if (n === 0) { const td = K.todayISO(); s.anim = td > s.cursor ? 'next' : td < s.cursor ? 'prev' : null; s.cursor = td; }
        else if (s.view === 'week') s.cursor = K.addDays(s.cursor, 7 * n);
        else if (s.view === 'month') s.cursor = K.toISO(new Date(c.getFullYear(), c.getMonth() + n, 1));
        else s.cursor = K.toISO(new Date(c.getFullYear() + n, 0, 1));
        if (n !== 0) s.anim = n > 0 ? 'next' : 'prev';
        OB.app.render(); return;
      }
      if ((b = t.closest('[data-month]'))) { s.view = 'month'; s.cursor = b.dataset.month; s.anim = 'zoom'; OB.app.render(); return; }
      if ((b = t.closest('[data-day]'))) { addModal(b.dataset.day); return; }
      if ((b = t.closest('[data-ex]'))) { root.querySelector('#verifyText').value = b.dataset.ex; return; }
      if ((b = t.closest('[data-connect]'))) {
        const id = b.dataset.connect, x = D.PEOPLE.find(p => p.id === id);
        OB.app.update(st => { if (!st.work.connected.includes(id)) st.work.connected.push(id); });
        OB.app.toast(x.name + '님께 사내 쪽지로 연결 요청을 보냈어요');
        return;
      }
      if ((b = t.closest('[data-kind]'))) { saveDraftForm(root); s.draft.kind = b.dataset.kind; OB.app.render(); return; }
      if (!(b = t.closest('[data-act]'))) return;
      const act = b.dataset.act;
      if (act === 'add') addModal();
      else if (act === 'recommend') { s.rec = null; loadRec(OB.app.state); const el = root.querySelector('#recPanel'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      else if (act === 'capture') captureModal();
      else if (act === 'verify') {
        const text = root.querySelector('#verifyText').value.trim();
        if (!text) { OB.app.toast('검증할 업무 내용을 적어 주세요'); return; }
        s.verifyText = text; s.verifyResult = 'loading';
        root.querySelector('#verifyOut').innerHTML = verifyResult(s);
        s.verifyResult = await OB.ai.verify(text);
        OB.app.update(st => { st.work.verified = true; });
      } else if (act === 'copy') {
        const ta = root.querySelector('#draftText');
        try { await navigator.clipboard.writeText(ta.value); } catch (err) { ta.select(); document.execCommand('copy'); }
        OB.app.toast('초안을 복사했어요');
      }
    });
    root.addEventListener('change', e => {
      const h = e.target.dataset && e.target.dataset.ho;
      if (h) OB.app.update(st => { st.work.handover[h] = e.target.checked; });
    });
    const memo = root.querySelector('#hoMemo');
    memo.addEventListener('blur', () => OB.app.update(st => { st.work.memo = memo.value; }, { render: false }));
    root.querySelector('#draftForm').addEventListener('submit', async e => {
      e.preventDefault();
      saveDraftForm(root);
      if (!s.draft.topic.trim()) { OB.app.toast('제목을 입력해 주세요'); return; }
      const btn = e.target.querySelector('.btn.primary');
      btn.disabled = true; btn.textContent = '작성 중…';
      s.draftOut = await OB.ai.draft(s.draft, state.user);
      OB.app.update(st => { st.work.drafted = true; });
    });
  }
  function saveDraftForm(root) {
    const f = root.querySelector('#draftForm'), d = ui().draft;
    ['purpose', 'to', 'topic', 'points', 'ref', 'attach'].forEach(k => { if (f[k]) d[k] = f[k].value; });
  }

  OB.views.work = { render, mount };
})();
