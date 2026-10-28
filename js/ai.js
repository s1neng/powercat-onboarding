// AI 기능 — 사내 전용 모델만 사용 (외부 전송 금지).
// config.AI_ENDPOINT가 비어 있으면 브라우저 안의 규칙 기반 시연 응답으로 동작한다.
(function () {
  const C = OB.config, K = OB.core, D = OB.data;
  const live = () => !!C.AI_ENDPOINT;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function call(task, payload) {
    const res = await fetch(C.AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, payload })
    });
    if (!res.ok) throw new Error('사내 AI 응답 오류 (' + res.status + ')');
    return res.json();
  }
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // WRK-03: 캡처 이미지 → 텍스트
  async function ocr(file) {
    if (live()) {
      const out = await call('ocr', { image: await fileToDataURL(file) });
      return { text: out.text || '', demo: false };
    }
    await wait(900);
    const t = K.todayISO();
    const d1 = K.parseISO(K.addDays(t, 3)), d2 = K.parseISO(K.addDays(t, 1));
    return {
      demo: true,
      text: [
        '보낸사람: 김OO 차장',
        '제목: [안내] 부서 업무회의 개최',
        '1. 일시: ' + d1.getFullYear() + '년 ' + (d1.getMonth() + 1) + '월 ' + d1.getDate() + '일 오후 2시',
        '2. 장소: 본부 3층 대회의실',
        '3. 회의 자료 제출: ' + (d2.getMonth() + 1) + '월 ' + d2.getDate() + '일까지'
      ].join('\n')
    };
  }

  // WRK-02: AI 일정 추천 (직무별 반복 업무 + 교육 마감 + 온보딩 체크포인트)
  function recommend(state) {
    const today = K.todayISO(), until = K.addDays(today, 60);
    const have = new Set(state.events.map(e => e.date + e.title));
    const out = [];
    const push = (date, time, title, why) => {
      if (date < today || date > until || have.has(date + title)) return;
      out.push({ id: K.uid(), date, time, title, why });
    };
    const base = K.parseISO(today);
    (D.JOB_CALENDAR[state.user.job] || []).forEach(j => {
      for (let i = 0; i < 2; i++) {
        const y = base.getFullYear(), m = base.getMonth() + i;
        const last = new Date(y, m + 1, 0).getDate();
        push(K.toISO(new Date(y, m, Math.min(j.day, last))), '10:00', j.title, state.user.job + ' 반복 업무');
      }
    });
    K.courses(state).filter(c => !c.doneAt).forEach(c => {
      const early = K.addDays(c.deadline, -3);
      if (early >= today) push(early, '16:00', c.name + ' 수강', '마감 3일 전 여유 확보');
      else push(today, '16:00', c.name + ' 수강', c.left < 0 ? '마감 경과 — 바로 수강 필요' : '마감 임박');
    });
    const p = K.periodOf(state, state.user.empId);
    [30, 60].filter(n => n < p).forEach(n => push(K.addDays(state.user.startDate, n), '15:00', '팀장 면담 (' + n + '일 체크인)', '온보딩 중간 점검'));
    push(K.addDays(state.user.startDate, p), '09:00', '온보딩 목표일', '졸업 목표');
    return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  // WRK-05: 업무검증 (규정·지침·매뉴얼에서 관련 조항 찾기)
  function verifyLocal(text) {
    const q = String(text || '');
    return D.REGULATIONS
      .map(r => ({ r, hits: r.keywords.filter(k => q.includes(k)) }))
      .filter(x => x.hits.length)
      .sort((a, b) => b.hits.length - a.hits.length)
      .slice(0, 3)
      .map(x => Object.assign({}, x.r, { hits: x.hits }));
  }
  async function verify(text) {
    if (live()) {
      try { const out = await call('verify', { text }); if (Array.isArray(out.items)) return out.items; } catch (e) { /* 사내 AI 실패 시 로컬 검색으로 */ }
    }
    await wait(500);
    return verifyLocal(text);
  }

  // WRK-07: 메일·공문 초안
  const PURPOSE = {
    '협조 요청': { mail: '아래 사항에 대해 협조를 요청드립니다.', doc: '협조를 요청' },
    '자료 제출 요청': { mail: '아래 자료의 제출을 요청드립니다.', doc: '자료 제출을 요청' },
    '결과 보고': { mail: '아래와 같이 결과를 보고드립니다.', doc: '결과를 보고' },
    '일정 안내': { mail: '아래와 같이 일정을 안내드립니다.', doc: '일정을 안내' },
    '감사 인사': { mail: '도움 주신 데 대해 감사의 말씀을 드립니다.', doc: '감사의 뜻을 전' }
  };
  const BULLET = ['가', '나', '다', '라', '마', '바'];
  function draftLocal(p, user) {
    const points = String(p.points || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const pur = PURPOSE[p.purpose] || PURPOSE['협조 요청'];
    const to = p.to || '담당자';
    const topic = p.topic || p.purpose;
    if (p.kind === 'doc') {
      return [
        '한국전력공사 ' + user.hq,
        '',
        '수신  ' + to,
        '(경유)',
        '제목  ' + topic,
        '',
        '1. 관련: ' + (p.ref || '해당 없음'),
        '2. ' + topic + '와(과) 관련하여 아래와 같이 ' + pur.doc + '하오니 업무에 참고하시기 바랍니다.',
        ...(points.length ? points : ['세부 내용']).map((s, i) => '  ' + BULLET[i % BULLET.length] + '. ' + s),
        '  ' + BULLET[Math.min(points.length || 1, BULLET.length - 1)] + '. 담당: ' + user.hq + ' ' + user.job + ' ' + user.name,
        '',
        '붙임  ' + (p.attach || '없음') + '.  끝.'
      ].join('\n');
    }
    return [
      '제목: [' + p.purpose + '] ' + topic,
      '',
      to + '님, 안녕하십니까.',
      user.hq + ' ' + user.job + ' 담당 ' + user.name + '입니다.',
      '',
      topic + ' 관련하여 ' + pur.mail,
      '',
      ...(points.length ? points.map(s => '- ' + s) : ['- (핵심 내용을 입력하세요)']),
      '',
      '확인 부탁드리며, 궁금하신 점은 편하게 연락 주십시오.',
      '감사합니다.',
      '',
      user.name + ' 드림'
    ].join('\n');
  }
  async function draft(p, user) {
    if (live()) {
      try { const out = await call('draft', Object.assign({ user }, p)); if (out.text) return { text: out.text, demo: false }; } catch (e) { /* 실패 시 서식 초안으로 */ }
    }
    await wait(600);
    return { text: draftLocal(p, user), demo: true };
  }

  OB.ai = { live, ocr, recommend, verify, verifyLocal, draft, draftLocal, PURPOSES: Object.keys(PURPOSE) };
})();
