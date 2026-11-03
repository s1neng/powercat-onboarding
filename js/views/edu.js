// EDU: 교육 이수율(이수 시간 기준), 교육추천 목록(직무 필수·직무 선택·공통역량·법정의무)·팀장 알림, 이달의 추천 교육(EDU-05)
(function () {
  const K = OB.core, D = OB.data, esc = K.esc;

  // ---------- EDU-05 이달의 추천 교육 ----------
  // N월 추천 교육 : 전체 / 직무필수(직무) / 공통역량 — 입문·법정은 '수료'로 표시, 직무필수 우선, 교육신청·캘린더 추가
  // 동기가 수강하고 있는 교육 : 같은 직군 동기(직무별 1명) 선택 → 동기 직무의 직무필수 / 공통역량, 이름 마스킹·필수교육 이수 현황
  const REQ_MAX = 100, DONE_MIN = 900; // rank 구간: 1~ 직무필수 · 101~ 공통역량 · 901~ 입문·법정(수료)
  const isReq = c => c.rank < REQ_MAX, isCommon = c => c.rank > REQ_MAX && c.rank < DONE_MIN, isDone = c => c.rank >= DONE_MIN;
  const MY_DEFAULT_JOB = '사무(경영지원)', PEER_DEFAULT_JOB = '사무(영업·요금)';

  function recUI() {
    const ui = OB.app.ui;
    if (!ui.rec) ui.rec = { month: new Date().getMonth() + 1, tab1: 'all', tab2: 'done' };
    return ui.rec;
  }
  function recFor(job) { return (D.EDU_REC && D.EDU_REC.byJob[job]) || null; }
  // 이달의 추천 교육에 보일 월: 엑셀 '월별달력' 시트 기준(recMonths), 없으면 카테고리 시트 개설월(months)
  const recM = c => c.recMonths || c.months;

  // 선택한 월의 실제 개설일(최근)을 앞으로 다가올 같은 월 날짜로 옮겨 '예정일'로 사용
  function plannedDate(c, m) {
    const inMonth = c.dates.filter(d => +d.slice(5, 7) === m).sort();
    const day = inMonth.length ? +inMonth[inMonth.length - 1].slice(8, 10) : 1;
    const now = new Date(), y = m >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
    const last = new Date(y, m, 0).getDate();
    return K.toISO(new Date(y, m - 1, Math.min(day, last)));
  }
  const evTitle = c => '[교육] ' + c.name;

  function nextReq(list, m) {
    for (let i = 1; i <= 12; i++) {
      const mm = (m + i - 1) % 12 + 1;
      const hit = list.filter(c => isReq(c) && recM(c).includes(mm)).sort((a, b) => a.rank - b.rank)[0];
      if (hit) return { month: mm, course: hit };
    }
    return null;
  }

  // 중복 검사 키: 같은 과정명 + 같은 날짜(선택한 월의 개설일)
  const dupKey = (c, m) => c.name.replace(/\s+/g, '') + '|' + c.dates.filter(d => +d.slice(5, 7) === m).join(',');
  function uniq(rows, m) {
    const seen = new Set();
    return rows.filter(c => { const k = dupKey(c, m); if (seen.has(k)) return false; seen.add(k); return true; });
  }

  // 동기 표시: 이름은 성만 남기고 가림, 필수교육(직무 필수 + 법정의무) 이수 현황
  const maskName = n => n ? n.slice(0, 1) + '*'.repeat(Math.max(n.length - 1, 1)) : '';
  function peerEdu(p) {
    const req = D.coursesFor(p.job).filter(c => c.required);
    const isDoneP = c => c.preDone || !!(p.eduDone || {})[c.id];
    const total = req.reduce((a, c) => a + c.hours, 0), done = req.filter(isDoneP).reduce((a, c) => a + c.hours, 0);
    return { n: req.filter(isDoneP).length, of: req.length, ratio: total ? done / total : 0 };
  }
  // 동기가 수강(이수·수료)한 교육 목록: 이수일 최근 순, 입사 시 수료 과정(신입사원 입문·채용 시 법정 안전교육)은 맨 아래
  function peerTaken(p) {
    const got = p.eduDone || {};
    const all = D.coursesFor(p.job);
    return all.filter(c => !c.preDone && got[c.id]).sort((a, b) => got[b.id].localeCompare(got[a.id]))
      .concat(all.filter(c => c.preDone));
  }
  function peerDoneBody(p) {
    const got = p.eduDone || {};
    const label = g => (D.GROUPS.find(x => x.key === g) || {}).label || '';
    const taken = peerTaken(p);
    const left = D.coursesFor(p.job).filter(c => c.required && !c.preDone && !got[c.id]);
    return (taken.length ? '<ul class="rec-list">' + taken.map(c =>
        '<li class="rec-item' + (c.required ? ' req' : '') + '"><div class="grow">' +
          '<div class="rec-name"><span class="tag ' + (c.required ? 'law' : '') + '">' + esc(label(c.group)) + '</span> <b>' + esc(c.name) + '</b></div>' +
          '<div class="small muted">' + c.hours + '시간' + (c.method ? ' · ' + esc(c.method) : '') + '</div></div>' +
          '<span class="ok small">✅ ' + (c.preDone ? '입사 시 수료' : K.fmtDate(got[c.id]) + ' 이수') + '</span></li>').join('') + '</ul>'
        : '<p class="rec-empty">아직 이수한 교육이 없어요.</p>') +
      (left.length ? '<p class="small muted">남은 필수교육 ' + left.length + '과정: ' + left.map(c => esc(c.name)).join(', ') + '</p>' : '');
  }
  const courseId = c => 'x:' + c.name.replace(/\s+/g, '');

  function item(c, m, state, peerMode, peerToo) {
    const learned = !peerMode && state.edu.done[courseId(c)]; // 교육추천 목록에서 이수 처리한 과정
    const applied = !peerMode && (state.edu.applied || {})[courseId(c)];
    const done = isDone(c) || !!learned, top = c.status === '최우선 추천' && !learned;
    const date = done ? null : plannedDate(c, m);
    const added = date && state.events.some(e => e.title === evTitle(c) && e.date === date);
    const recent = c.dates.filter(d => +d.slice(5, 7) === m).slice(-2).map(d => d.slice(2).replace(/-/g, '.'));
    return '<li class="rec-item' + (done ? ' done' : '') + (top ? ' top' : '') + (isReq(c) ? ' req' : '') + '">' +
      '<div class="grow">' +
        '<div class="rec-name">' +
          (top ? '<span class="rec-badge top">최우선 추천</span>' : '') +
          '<span class="tag ' + (isReq(c) ? 'law' : '') + '">' + esc(c.kind) + '</span> <b>' + esc(c.name) + '</b>' +
          (peerToo ? '<span class="rec-badge peer">👥 동기' + (peerToo > 1 ? ' ' + peerToo + '명' : '') + '도 수강</span>' : '') +
        '</div>' +
        '<div class="small muted">' + esc(c.method) + ' · ' + esc(c.days) + ' · ' + c.hours + 'h · ' + esc(c.dept) +
          (done ? '' : recent.length ? ' · 최근 개설 ' + recent.join(', ') : '') + '</div>' +
      '</div>' +
      (done ? '<span class="ok">✅ ' + (learned ? '이수' : '수료') + '</span>'
        : peerMode ? '<span class="rec-peer">동기 수강</span>'
        : '<div class="rec-acts">' +
          '<button class="btn small ' + (applied ? 'applied' : 'primary') + '" data-recapply="' + esc(c.name) + '" aria-pressed="' + !!applied + '"' +
            ' title="' + (applied ? K.fmtDate(applied) + ' 신청 · 누르면 신청 취소' : '교육신청') + '">' + (applied ? '✓ 신청완료' : '교육신청') + '</button>' +
          '<button class="btn small ' + (added ? 'ghost' : '') + '" data-recadd="' + esc(c.name) + '"' + (added ? ' disabled' : '') +
            ' title="' + esc(K.fmtDate(date, true)) + ' 예정(작년 개설일 기준)">' + (added ? '캘린더에 있음' : '캘린더에 추가') + '</button>' +
        '</div>') +
      '</li>';
  }

  function list(rows, m, state, peerMode, emptyMsg, peerKeys) {
    return rows.length ? '<ul class="rec-list">' + rows.map(c => item(c, m, state, peerMode, peerKeys && peerKeys.get(dupKey(c, m)))).join('') + '</ul>'
      : '<p class="rec-empty">' + emptyMsg + '</p>';
  }

  function tabs(name, cur, defs) {
    return '<div class="rec-tabs" role="tablist">' + defs.map(([k, label, n]) =>
      '<button class="rec-tab' + (k === cur ? ' on' : '') + '" role="tab" aria-selected="' + (k === cur) + '" data-' + name + '="' + k + '">' +
      esc(label) + ' <em>' + n + '</em></button>').join('') + '</div>';
  }

  function renderRec(state) {
    if (!D.EDU_REC) return '';
    const u = state.user, ui = recUI(), m = ui.month;
    const myJob = recFor(u.job) ? u.job : MY_DEFAULT_JOB, mine = recFor(myJob);
    const inM = c => recM(c).includes(m), byRank = (a, b) => a.rank - b.rank;

    // 카테고리 1
    // ①은 직무필수 → 공통역량 → 수료 순으로 같은 날짜·과정명이 한 번만 남도록 검사
    const all1 = uniq(mine.courses.filter(c => !isDone(c) && inM(c)).sort(byRank).concat(mine.courses.filter(isDone).sort(byRank)), m);
    const req1 = all1.filter(isReq), com1 = all1.filter(isCommon);
    const done1 = all1.filter(isDone); // 수료 과정은 월과 관계없이 표시
    const keys1 = new Set(all1.filter(c => !isDone(c)).map(c => dupKey(c, m)));
    const nx = req1.length ? null : nextReq(mine.courses, m);
    const reqEmpty = m + '월에는 직무필수 개설 예정이 없어요.' +
      (nx ? ' 다음 개설: <b>' + nx.month + '월 ' + esc(nx.course.name) + '</b>' : '');
    // 동기: 같은 직군(사무)의 동기 — 같은 직무 1명 + 다른 직무 1명씩
    const group = j => j.split('(')[0];
    const peers = D.PEERS.filter(p => group(p.job) === group(myJob) && recFor(p.job))
      .sort((a, b) => (a.job === myJob ? 0 : 1) - (b.job === myJob ? 0 : 1));
    const pickJobs = [], peersShown = peers.filter(p => !pickJobs.includes(p.job) && pickJobs.push(p.job));
    if (!peersShown.some(p => p.empId === ui.peer)) ui.peer = (peersShown.find(p => p.job !== myJob) || peersShown[0] || {}).empId;
    const sel = peersShown.find(p => p.empId === ui.peer);
    const monthOf = p => uniq(recFor(p.job).courses.filter(c => !isDone(c) && inM(c)).sort(byRank), m);
    // 같은 날짜·과정명 검사: 추천 교육과 겹치는 동기 과정은 추천 교육 쪽에 '👥 동기도 수강'으로 한 번만 표시
    const sharedKeys = new Map();
    peersShown.forEach(p => monthOf(p).forEach(c => { const k = dupKey(c, m); if (keys1.has(k)) sharedKeys.set(k, (sharedKeys.get(k) || 0) + 1); }));
    const theirs = sel ? recFor(sel.job) : null, all2 = sel ? monthOf(sel) : [];
    const shared = all2.filter(c => keys1.has(dupKey(c, m)));
    const req2 = all2.filter(c => isReq(c) && !keys1.has(dupKey(c, m)));
    const com2 = all2.filter(c => isCommon(c) && !keys1.has(dupKey(c, m)));
    const sharedNote = shared.length ? '<p class="rec-note">' + m + '월 추천 교육과 같은 날짜·같은 과정 <b>' + shared.length + '개</b>(' +
      shared.map(c => esc(c.name)).slice(0, 3).join(', ') + (shared.length > 3 ? ' 외' : '') + ')는 추천 교육에 <b>👥 동기도 수강</b>으로 한 번만 표시했어요.</p>' : '';
    const body2 = !sel ? '<p class="rec-empty">같은 직군 동기 정보가 없어요.</p>' : ui.tab2 === 'done' ? peerDoneBody(sel) : ui.tab2 === 'common'
      ? list(com2, m, state, true, m + '월에 추천 교육과 겹치지 않는 동기 공통역량 과정이 없어요.')
      : list(req2, m, state, true, m + '월에 추천 교육과 겹치지 않는 동기 ' + esc(theirs.jobLabel) + ' 과정이 없어요.');
    const peerCards = peersShown.map(p => {
      const e = peerEdu(p);
      return '<button class="peer-pick' + (p === sel ? ' on' : '') + '" data-recpeer="' + esc(p.empId) + '" aria-pressed="' + (p === sel) + '">' +
        '<span class="avatar">' + esc(p.nickname.slice(0, 1)) + '</span>' +
        '<span class="peer-pick-info"><b>' + esc(p.nickname) + '</b><span class="small muted">' + esc(maskName(p.name)) + ' · ' + esc(p.hq) + ' · ' + esc(p.job) + '</span>' +
          '<span class="peer-edu"><span class="small">필수교육 <b>' + e.n + '</b> / ' + e.of + '과정 · ' + K.pct(e.ratio) + '%</span>' + OB.app.bar(e.ratio, 'edu') + '</span></span>' +
      '</button>';
    }).join('');

    let body1;
    if (ui.tab1 === 'req') body1 = list(req1, m, state, false, reqEmpty, sharedKeys);
    else if (ui.tab1 === 'common') body1 = list(com1, m, state, false, m + '월 개설 예정인 공통역량 과정이 없어요.', sharedKeys);
    else body1 =
      '<h4 class="rec-sub">' + esc(mine.jobLabel) + '</h4>' + list(req1, m, state, false, reqEmpty, sharedKeys) +
      '<h4 class="rec-sub">공통역량</h4>' + list(com1, m, state, false, m + '월 개설 예정인 공통역량 과정이 없어요.', sharedKeys) +
      '<h4 class="rec-sub">입문·법정 교육</h4>' + list(done1, m, state, false, '');

    const reqCount = mm => mine.courses.filter(c => isReq(c) && recM(c).includes(mm)).length;
    const allCount = mm => mine.courses.filter(c => !isDone(c) && recM(c).includes(mm)).length;
    const nowM = new Date().getMonth() + 1;

    return '<article class="card span12 rec-head">' +
        '<div class="card-head"><h2>🗓️ 이달의 추천 교육</h2></div>' +
        '<div class="rec-months" role="group" aria-label="월 선택">' +
        Array.from({ length: 12 }, (_, i) => i + 1).map(mm =>
          '<button class="rec-month' + (mm === m ? ' on' : '') + (mm === nowM ? ' now' : '') + '" data-recm="' + mm + '" aria-pressed="' + (mm === m) + '"' +
          ' title="' + mm + '월 · 직무필수 ' + reqCount(mm) + ' / 전체 ' + allCount(mm) + '과정">' +
          '<b>' + mm + '월</b><span class="rec-dots">' + '<i></i>'.repeat(Math.min(reqCount(mm), 4)) + '</span>' +
          '<small>' + allCount(mm) + '과정</small></button>').join('') +
        '</div>' +
        '<p class="small muted">● 빨간 점 = 직무필수 과정 수 · 개설일은 2025·2026년 실적 기준 예상이니 실제 일정은 교육 공지를 확인하세요.</p>' +
      '</article>' +
      '<article class="card span7 rec-card">' +
        '<div class="card-head"><h2>' + m + '월 추천 교육</h2><span class="small muted">' + esc(u.name) + ' · ' + esc(myJob) +
          (recFor(u.job) ? '' : ' 기준(예시)') + '</span></div>' +
        tabs('rectab1', ui.tab1, [['all', '전체', req1.length + com1.length + done1.length], ['req', mine.jobLabel, req1.length], ['common', '공통역량', com1.length]]) +
        body1 +
      '</article>' +
      '<article class="card span5 rec-card">' +
        '<div class="card-head"><h2>동기가 수강하고 있는 교육</h2><span class="small muted">같은 직군 동기</span></div>' +
        '<div class="rec-peers">' + peerCards + '</div>' +
        (sel ? tabs('rectab2', ui.tab2, [['done', '수강 완료', peerTaken(sel).length], ['req', m + '월 ' + theirs.jobLabel, req2.length], ['common', m + '월 공통역량', com2.length]]) : '') +
        body2 + (ui.tab2 === 'done' ? '' : sharedNote) +
      '</article>';
  }

  // ---------- EDU-02 교육추천 목록 (4구간) ----------
  function eduOpen() {
    const ui = OB.app.ui;
    if (!ui.eduOpen) ui.eduOpen = { jobReq: true, jobOpt: false, common: false, law: true };
    return ui.eduOpen;
  }
  function monthStrip(c) {
    if (!c.months || !c.months.length) return '<span class="small muted">상시·입사일 기준</span>';
    const nm = c.next && !c.doneAt ? +c.next.slice(5, 7) : 0; // 다음 개설월 강조 (이수·수료 과정은 제외)
    return '<span class="mstrip" aria-label="개설 예정월 ' + c.months.join(', ') + '월">' +
      Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
        '<i class="' + (c.months.includes(m) ? 'on' : '') + (m === nm ? ' next' : '') + '">' + m + '</i>').join('') + '</span>';
  }
  function whenCell(c) {
    if (c.doneAt === 'pre') return '<span class="small muted">입사 시 수료</span>';
    if (c.deadline) return '마감 ' + K.fmtDate(c.deadline) + ' <span class="small ' + (c.alert ? 'red' : 'muted') + '">' + (c.doneAt ? '' : K.ddayLabel(c.left)) + '</span>';
    if (c.doneAt) return '<span class="small muted">' + K.fmtDate(c.doneAt) + ' 이수</span>';
    if (c.next && !c.doneAt) return '다음 개설 ' + K.fmtDate(c.next) + ' <span class="small muted">' + K.ddayLabel(c.nextLeft) + '</span>';
    return '<span class="small muted">-</span>';
  }
  function courseRow(c, state) {
    const sent = state.notifications.some(n => n.courseId === c.id);
    const evAdded = c.next && state.events.some(e => e.title === evTitle(c) && e.date === c.next);
    const status = c.doneAt === 'pre' ? '<span class="ok">✅ 수료</span>' : c.doneAt ? '<span class="ok">✅ 이수</span>'
      : c.deadline && c.left < 0 ? '<span class="red">기한 경과</span>'
      : (state.edu.applied || {})[c.id] ? '<span class="applied-tag">신청완료</span>' : c.required ? '미이수' : '<span class="muted">추천</span>';
    let acts = '';
    if (c.doneAt === 'pre') acts = '';
    else if (c.doneAt) acts = '<button class="btn ghost small" data-undo="' + esc(c.id) + '">취소</button>';
    else acts = '<button class="btn small ' + (c.required ? 'primary' : '') + '" data-done="' + esc(c.id) + '">이수 완료</button>' +
      (c.alert ? '<button class="btn small ' + (sent ? 'ghost' : 'warnbtn') + '" data-notify="' + esc(c.id) + '">' + (sent ? '알림 재발송' : '팀장 알림') + '</button>' : '') +
      (c.next ? '<button class="btn small ghost" data-calnext="' + esc(c.id) + '"' + (evAdded ? ' disabled' : '') + ' title="' + esc(K.fmtDate(c.next, true)) + ' 개설 예정">' + (evAdded ? '캘린더에 있음' : '📅 캘린더') + '</button>' : '');
    const meta = [c.hours + '시간'].concat(c.method ? [c.method, c.days, c.dept] : []).map(esc).join(' · ');
    return '<li class="erow' + (c.alert ? ' warn' : '') + (c.doneAt ? ' done' : '') + '">' +
      '<div class="erow-main"><div class="cname"><span class="tag ' + (c.required ? 'law' : '') + '">' + esc(c.kind || '') + '</span> ' + esc(c.name) + '</div>' +
        '<div class="small muted">' + meta + '</div></div>' +
      '<div class="erow-when">' + monthStrip(c) + '<div class="when">' + whenCell(c) + '</div></div>' +
      '<div class="erow-act"><span class="erow-status">' + status + '</span>' + acts + '</div>' +
    '</li>';
  }
  function groupBlock(g, list, state) {
    const doneN = list.filter(c => c.doneAt).length, open = eduOpen()[g.key];
    return '<details class="egroup egroup-' + g.key + '" data-grp="' + g.key + '"' + (open ? ' open' : '') + '>' +
      '<summary><b>' + esc(g.label) + '</b><span class="small muted">' + esc(g.desc) + '</span>' +
        '<span class="egroup-cnt">' + doneN + ' / ' + list.length + '과정</span></summary>' +
      (list.length ? '<ul class="elist">' + list.map(c => courseRow(c, state)).join('') + '</ul>' : '<p class="rec-empty">해당 과정이 없어요.</p>') +
      '</details>';
  }

  function render(state) {
    const p = K.progress(state), cs = K.courses(state), u = state.user;
    const req = cs.filter(c => c.required), opt = cs.filter(c => !c.required);
    const total = req.reduce((a, c) => a + c.hours, 0), done = req.filter(c => c.doneAt).reduce((a, c) => a + c.hours, 0);
    const extraH = opt.filter(c => c.doneAt).reduce((a, c) => a + c.hours, 0);
    const G = {}; cs.forEach(c => (G[c.group] = G[c.group] || []).push(c));
    D.GROUPS.forEach(g => { G[g.key] = G[g.key] || []; });
    const cnt = (list, isDone) => list.filter(c => !!c.doneAt === isDone).length;
    const alerts = cs.filter(c => c.alert);
    const today = K.todayISO();

    return OB.app.header('교육', p.edu, 'edu') +
      (alerts.length ? '<div class="alert">⏰ 마감이 ' + OB.config.ALERT_DAYS_BEFORE + '일 이내이거나 지난 미이수 교육이 <b>' + alerts.length + '건</b> 있어요. 팀장님께 자동으로 알림 대상에 올라갑니다.</div>' : '') +
      '<section class="grid">' +
        '<article class="card span4 edu-sum">' +
          '<h2>필수교육 이수 현황</h2>' + OB.app.ring(p.edu, 140, '이수율') +
          '<dl class="kv">' +
            '<dt>이수 시간</dt><dd><b>' + done + '</b> / ' + total + '시간' + (extraH ? '<span class="kv-sub">+ 선택·공통 ' + extraH + '시간</span>' : '') + '</dd>' +
            '<dt>직무교육</dt><dd>필수 <b>' + cnt(G.jobReq, true) + '</b> / ' + G.jobReq.length + ' · 선택 <b>' + cnt(G.jobOpt, true) + '</b> / ' + G.jobOpt.length + '과정</dd>' +
            '<dt>공통교육</dt><dd><b>' + cnt(G.common, true) + '</b> / ' + G.common.length + '과정</dd>' +
            '<dt>법정의무교육</dt><dd><b>' + cnt(G.law, true) + '</b> / ' + G.law.length + '과정</dd>' +
          '</dl>' +
          '<p class="small muted">KPI 연계: 이수율은 <b>직무 필수 + 법정의무</b>의 <b>이수 시간</b> 기준이에요. 직무 선택·공통역량은 추천 과정으로 이수 시간만 따로 모아 보여 드려요.</p>' +
        '</article>' +
        '<article class="card span8 edu-list">' +
          '<div class="card-head"><h2>교육추천 목록</h2><span class="muted small">개설월·다음 개설일: 월별 교육 달력 데이터 연계</span></div>' +
          D.GROUPS.map(g => groupBlock(g, G[g.key] || [], state)).join('') +
        '</article>' +
        renderRec(state) +
      '</section>';
  }

  function notify(c) {
    const st = OB.app.state, u = st.user;
    OB.app.update(s => s.notifications.push({ id: K.uid(), courseId: c.id, courseName: c.name, empId: u.empId, name: u.name, deadline: c.deadline, at: new Date().toISOString(), to: s.leaderEmail || '(미설정)' }));
    OB.app.toast('팀장 알림을 기록했어요. 메일 작성창을 엽니다');
    OB.app.mailto('[온보딩] ' + u.name + ' 필수교육 미이수 알림 - ' + c.name,
      '팀장님, 안녕하십니까.\n\n' + u.hq + ' ' + u.job + ' ' + u.name + '(' + u.empId + ')의 필수교육 이수 현황을 알려드립니다.\n\n' +
      '- 과정: ' + c.name + ' (' + c.hours + '시간)\n- 마감: ' + c.deadline + ' (' + K.ddayLabel(c.left) + ')\n- 상태: 미이수\n\n기한 내 이수하도록 하겠습니다.\n\n파워캣 온보딩 시스템');
  }

  function mount(root, state) {
    // 구간 펼침 상태 기억 (toggle 이벤트는 버블링되지 않아 캡처로 받음)
    root.addEventListener('toggle', e => {
      const d = e.target.closest && e.target.closest('[data-grp]');
      if (d) eduOpen()[d.dataset.grp] = d.open;
    }, true);
    root.addEventListener('click', e => {
      let b;
      const find = id => K.courses(OB.app.state).find(c => c.id === id);
      if ((b = e.target.closest('[data-done]'))) {
        const c = find(b.dataset.done);
        OB.app.update(s => { s.edu.done[c.id] = K.todayISO(); });
        OB.app.toast('"' + c.name + '" 이수 완료! +' + c.hours + '시간');
      } else if ((b = e.target.closest('[data-undo]'))) {
        OB.app.update(s => { delete s.edu.done[b.dataset.undo]; });
      } else if ((b = e.target.closest('[data-notify]'))) {
        notify(find(b.dataset.notify));
      } else if ((b = e.target.closest('[data-calnext]'))) {
        const c = find(b.dataset.calnext);
        OB.app.update(s => s.events.push({ id: K.uid(), date: c.next, time: '', title: evTitle(c), source: '교육추천 목록' }));
        OB.app.toast(K.fmtDate(c.next, true) + ' 개설 예정으로 캘린더에 추가했어요');
      } else if ((b = e.target.closest('[data-recm]'))) {
        recUI().month = +b.dataset.recm; OB.app.render();
      } else if ((b = e.target.closest('[data-rectab1]'))) {
        recUI().tab1 = b.dataset.rectab1; OB.app.render();
      } else if ((b = e.target.closest('[data-rectab2]'))) {
        recUI().tab2 = b.dataset.rectab2; OB.app.render();
      } else if ((b = e.target.closest('[data-recpeer]'))) {
        recUI().peer = b.dataset.recpeer; OB.app.render();
      } else if ((b = e.target.closest('[data-recapply]'))) {
        const id = 'x:' + b.dataset.recapply.replace(/\s+/g, ''), was = (OB.app.state.edu.applied || {})[id];
        OB.app.update(s => { s.edu.applied = s.edu.applied || {}; if (was) delete s.edu.applied[id]; else s.edu.applied[id] = K.todayISO(); });
        OB.app.toast(was ? '"' + b.dataset.recapply + '" 교육신청을 취소했어요' : '"' + b.dataset.recapply + '" 교육신청을 기록했어요');
        if (!was && OB.config.EDU_APPLY_URL) window.open(OB.config.EDU_APPLY_URL, '_blank', 'noopener');
      } else if ((b = e.target.closest('[data-recadd]'))) {
        const st = OB.app.state, mine = recFor(st.user.job) || recFor(MY_DEFAULT_JOB);
        const c = mine.courses.find(x => x.name === b.dataset.recadd), date = plannedDate(c, recUI().month);
        OB.app.update(s => s.events.push({ id: K.uid(), date, time: '', title: evTitle(c), source: '교육 추천' }));
        OB.app.toast(K.fmtDate(date, true) + ' 예정으로 캘린더에 추가했어요');
      }
    });
  }

  OB.views.edu = { render, mount, _rec: { plannedDate, nextReq, isReq, isCommon, isDone } };
})();
