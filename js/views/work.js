// WORK: 업무 이수율, 캘린더(주·월·연 / 직접추가 / AI추천 / 캡처 반영), 인수인계, 업무검증, 담당자 추천, 메일·공문 초안
(function () {
  const K = OB.core, D = OB.data, esc = K.esc;

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
    return state.events.map(e => Object.assign({ kind: 'mine' }, e)).concat(fixed)
      .sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
  }
  const byDate = evs => evs.reduce((m, e) => ((m[e.date] = m[e.date] || []).push(e), m), {});
  const chip = e => '<span class="ev ' + e.kind + '" data-ev="' + esc(e.id) + '" title="' + esc((e.time ? e.time + ' ' : '') + e.title) + '">' + (e.time ? '<em>' + e.time + '</em>' : '') + esc(e.title) + '</span>';

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
        '<span class="dnum">' + d.getDate() + '</span>' + evs.slice(0, 3).map(chip).join('') +
        (evs.length > 3 ? '<span class="more">+' + (evs.length - 3) + '</span>' : '') + '</div>';
    }
    return h + '</div>';
  }
  function weekGrid(cursor, map, today) {
    const start = weekStart(cursor);
    let h = '<div class="week">';
    for (let i = 0; i < 7; i++) {
      const iso = K.addDays(start, i), evs = map[iso] || [];
      h += '<div class="wday' + (iso === today ? ' today' : '') + '" data-day="' + iso + '"><div class="wday-head"><b>' + K.WEEK[i] + '</b> ' + K.parseISO(iso).getDate() + '</div>' +
        (evs.length ? evs.map(chip).join('') : '<span class="muted small">일정 없음</span>') + '</div>';
    }
    return h + '</div>';
  }
  function yearGrid(cursor, evs) {
    const y = K.parseISO(cursor).getFullYear();
    let h = '<div class="year">';
    for (let m = 0; m < 12; m++) {
      const prefix = y + '-' + String(m + 1).padStart(2, '0');
      const list = evs.filter(e => e.date.startsWith(prefix));
      const days = new Set(list.map(e => +e.date.slice(8)));
      const firstDow = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate();
      let cells = '';
      for (let i = 0; i < firstDow; i++) cells += '<i></i>';
      for (let d = 1; d <= n; d++) cells += '<i class="' + (days.has(d) ? 'has' : '') + '">' + d + '</i>';
      h += '<button class="mini" data-month="' + prefix + '-01"><b>' + (m + 1) + '월</b><span class="muted small">' + list.length + '건</span><div class="mini-grid">' + cells + '</div></button>';
    }
    return h + '</div>';
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
        '<article class="card span8 calendar">' +
          '<div class="card-head wrap"><h2>캘린더</h2>' +
            '<div class="tabs" role="tablist">' + [['week', '주간'], ['month', '월간'], ['year', '연간']].map(([k, l]) => '<button role="tab" aria-selected="' + (s.view === k) + '" class="' + (s.view === k ? 'on' : '') + '" data-view="' + k + '">' + l + '</button>').join('') + '</div>' +
          '</div>' +
          '<div class="cal-bar"><div class="row"><button class="btn ghost icon" data-nav="-1" aria-label="이전">‹</button><b class="cal-title">' + calTitle(s) + '</b><button class="btn ghost icon" data-nav="1" aria-label="다음">›</button><button class="btn ghost small" data-nav="0">오늘</button></div>' +
            '<div class="row gap-s"><button class="btn small" data-act="add">+ 일정</button><button class="btn small ai" data-act="recommend">✨ AI 추천</button><button class="btn small ai" data-act="capture">📷 메일·쪽지 반영</button></div></div>' +
          cal +
          '<div class="legend small muted"><span class="ev mine">내 일정</span><span class="ev edu">교육 마감</span><span class="ev goal">온보딩 목표일</span></div>' +
        '</article>' +
        '<article class="card span4 handover">' +
          '<div class="card-head"><h2>인수인계</h2><span class="muted small">' + ho.filter(i => i.done).length + '/' + ho.length + '</span></div>' +
          '<ul class="checklist">' + ho.map(i => '<li><label><input type="checkbox" data-ho="' + i.id.slice(3) + '"' + (i.done ? ' checked' : '') + '><span>' + esc(i.label) + '</span></label></li>').join('') + '</ul>' +
          '<label class="small muted">인수인계 메모<textarea id="hoMemo" rows="4" placeholder="전임자 연락처, 주의사항 등">' + esc(state.work.memo) + '</textarea></label>' +
        '</article>' +
        '<article class="card span6 verify">' +
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

  // ---------- 모달: 일정 추가 / 상세 / AI 추천 / 캡처 ----------
  function addModal(date) {
    OB.app.modal('일정 추가', '<form id="evForm" class="stack"><label>제목<input name="title" required maxlength="40" placeholder="예) 팀 주간회의"></label>' +
      '<div class="row gap-s"><label class="grow">날짜<input type="date" name="date" required value="' + (date || K.todayISO()) + '"></label><label class="grow">시간<input type="time" name="time"></label></div>' +
      '<button class="btn primary">추가</button></form>', dlg => {
      const f = dlg.querySelector('#evForm').elements;
      f.title.focus();
      dlg.querySelector('#evForm').onsubmit = e => {
        e.preventDefault();
        const t = f.title.value.trim();
        if (!t || !K.isValidISO(f.date.value)) return;
        OB.app.update(st => st.events.push({ id: K.uid(), date: f.date.value, time: f.time.value, title: t, source: '직접' }));
        OB.app.closeModal();
        OB.app.toast('일정을 추가했어요');
      };
    });
  }
  function eventModal(id) {
    const e = allEvents(OB.app.state).find(x => x.id === id);
    if (!e) return;
    OB.app.modal(e.title, '<p>' + K.fmtDate(e.date, true) + (e.time ? ' ' + e.time : '') + '</p>' +
      (e.fixed ? '<p class="muted small">' + (e.kind === 'edu' ? '교육 페이지에서 이수하면 사라져요.' : '관리자가 지정한 온보딩 기간으로 계산된 날짜예요.') + '</p>' :
        '<p class="muted small">등록 경로: ' + esc(e.source || '직접') + '</p><button class="btn danger" id="delEv">삭제</button>'), dlg => {
      const b = dlg.querySelector('#delEv');
      if (b) b.onclick = () => { OB.app.update(st => { st.events = st.events.filter(x => x.id !== id); }); OB.app.closeModal(); OB.app.toast('일정을 삭제했어요'); };
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
  function recommendModal() {
    const list = OB.ai.recommend(OB.app.state);
    OB.app.modal('✨ AI 일정 추천', '<p class="small muted">직무별 반복 업무, 교육 마감, 온보딩 체크포인트를 바탕으로 앞으로 60일 일정을 제안해요.</p>' + candidateList(list), dlg => bindCandidates(dlg, 'AI 추천'));
  }
  function captureModal() {
    OB.app.modal('📷 메일 · 쪽지 캘린더 반영',
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
  function mount(root, state) {
    const s = ui();
    root.addEventListener('click', async e => {
      const t = e.target;
      let b;
      if ((b = t.closest('[data-ev]'))) { e.stopPropagation(); eventModal(b.dataset.ev); return; }
      if ((b = t.closest('[data-view]'))) { s.view = b.dataset.view; OB.app.render(); return; }
      if ((b = t.closest('[data-nav]'))) {
        const n = +b.dataset.nav, c = K.parseISO(s.cursor);
        if (n === 0) s.cursor = K.todayISO();
        else if (s.view === 'week') s.cursor = K.addDays(s.cursor, 7 * n);
        else if (s.view === 'month') s.cursor = K.toISO(new Date(c.getFullYear(), c.getMonth() + n, 1));
        else s.cursor = K.toISO(new Date(c.getFullYear() + n, 0, 1));
        OB.app.render(); return;
      }
      if ((b = t.closest('[data-month]'))) { s.view = 'month'; s.cursor = b.dataset.month; OB.app.render(); return; }
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
      else if (act === 'recommend') recommendModal();
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
