// 공통 로직: 날짜, 저장소, 이수율, 일정 추출. 화면과 분리된 순수 함수 위주 (tests.html에서 검증)
(function () {
  const C = OB.config;

  // ---------- 문자열 ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- 날짜 (로컬 날짜 'YYYY-MM-DD' 문자열로 다룸) ----------
  const pad = n => String(n).padStart(2, '0');
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function todayISO() { return toISO(new Date()); }
  function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
  function diffDays(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
  function isValidISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && toISO(parseISO(s)) === s; }
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  function fmtDate(iso, withDow) {
    const d = parseISO(iso);
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일' + (withDow ? ' (' + WEEK[d.getDay()] + ')' : '');
  }

  // ---------- 저장소 ----------
  function defaultState() {
    return {
      version: 3,
      user: null, // { empId, name, job, hq, startDate, nickname }
      periods: {}, // empId → 온보딩 기간(일), 관리자 지정 (D-01)
      events: [], // { id, date, time, title, source }
      work: { handover: {}, memo: '', verified: false, drafted: false, connected: [] },
      edu: { done: {} }, // courseId → 이수일
      notifications: [], // { id, courseId, courseName, at, to }
      region: { statsChecked: false, traitsChecked: false, places: [] },
      cheers: {}, // 동기 empId → 보낸 응원 수
      graduation: null, // { giftId, at }
      leaderEmail: '',
      voice: true
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(C.STORAGE_KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      if (!s || s.version !== 3) return defaultState();
      // 누락된 필드 보충 (이전 저장본 호환)
      const d = defaultState();
      return Object.assign(d, s, {
        work: Object.assign(d.work, s.work),
        edu: Object.assign(d.edu, s.edu),
        region: Object.assign(d.region, s.region)
      });
    } catch (e) {
      return defaultState(); // 손상된 저장값은 초기화
    }
  }
  function save(state) {
    try { localStorage.setItem(C.STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 저장 불가 환경: 메모리로만 동작 */ }
  }
  function reset() { try { localStorage.removeItem(C.STORAGE_KEY); } catch (e) { } }

  // ---------- 온보딩 기간 ----------
  function periodOf(state, empId) { return state.periods[empId] || C.DEFAULT_PERIOD_DAYS; }
  function dday(state, today) {
    today = today || todayISO();
    const u = state.user;
    const period = periodOf(state, u.empId);
    const target = addDays(u.startDate, period);
    const left = diffDays(today, target);
    const elapsed = Math.max(0, Math.min(period, diffDays(u.startDate, today)));
    return { period, target, left, elapsed, ratio: elapsed / period };
  }
  function ddayLabel(left) { return left > 0 ? 'D-' + left : left === 0 ? 'D-DAY' : 'D+' + (-left); }

  // ---------- 이수율 (D-02) ----------
  function workItems(state) {
    const w = state.work;
    const items = OB.data.handoverFor(state.user.job).map(h => ({ id: 'ho:' + h.id, label: h.label, done: !!w.handover[h.id], kind: '인수인계' }));
    return items.concat([
      { id: 'm:event', label: '캘린더에 첫 일정 등록', done: state.events.length > 0, kind: '미션' },
      { id: 'm:verify', label: '업무검증 1회 해보기', done: !!w.verified, kind: '미션' },
      { id: 'm:peer', label: '동일분야 담당자 1명과 연결', done: w.connected.length > 0, kind: '미션' },
      { id: 'm:draft', label: 'AI로 메일·공문 초안 작성', done: !!w.drafted, kind: '미션' }
    ]);
  }
  function courses(state, today) {
    today = today || todayISO();
    return OB.data.coursesFor(state.user.job).map(c => {
      const deadline = addDays(state.user.startDate, c.offset);
      const doneAt = state.edu.done[c.id] || null;
      const left = diffDays(today, deadline);
      return Object.assign({}, c, {
        deadline, doneAt, left,
        alert: !doneAt && left <= C.ALERT_DAYS_BEFORE // 마감 임박 또는 지남
      });
    });
  }
  function regionItems(state) {
    const types = state.region.places.map(p => p.type);
    // 전국 비교 데이터가 있는 본부만 'OO본부 특징 확인하기' 항목 추가 (없으면 확인할 화면이 없음)
    const R = OB.regionData, real = R && state.user && R.hq === state.user.hq && R.metros && R.metros.length >= 3;
    return (real ? [{ id: 'traits', label: state.user.hq + ' 특징 확인하기', done: !!state.region.traitsChecked }] : []).concat([
      { id: 'stats', label: (real ? '시군구' : '사업소') + '별 전력사용량 지표 확인', done: !!state.region.statsChecked },
      { id: 'food', label: '맛집 1곳 등록', done: types.includes('food') },
      { id: 'tour', label: '관광지 1곳 등록', done: types.includes('tour') },
      { id: 'trait', label: '지역특성 1가지 등록', done: types.includes('trait') }
    ]);
  }
  const ratio = items => items.length ? items.filter(i => i.done).length / items.length : 0;
  function progress(state, today) {
    const work = ratio(workItems(state));
    const cs = courses(state, today);
    const total = cs.reduce((a, c) => a + c.hours, 0);
    const edu = total ? cs.filter(c => c.doneAt).reduce((a, c) => a + c.hours, 0) / total : 0;
    const region = ratio(regionItems(state));
    const W = C.WEIGHTS;
    const overall = work * W.work + edu * W.edu + region * W.region;
    return { work, edu, region, overall, complete: work === 1 && edu === 1 && region === 1 };
  }
  // 100% 미만인데 반올림으로 100이 보이지 않도록 내림
  const pct = r => Math.floor(r * 100 + 1e-9);

  // ---------- 메일·쪽지 텍스트에서 일정 추출 (WRK-03) ----------
  const DOW = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
  function validYMD(y, m, d) { const iso = y + '-' + pad(m) + '-' + pad(d); return isValidISO(iso) ? iso : null; }

  function findDate(line, baseISO) {
    const base = parseISO(baseISO);
    let m;
    if ((m = line.match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?/))) {
      const iso = validYMD(+m[1], +m[2], +m[3]); if (iso) return { iso, raw: m[0] };
    }
    if ((m = line.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/)) || (m = line.match(/(?<![\d:.])(\d{1,2})\/(\d{1,2})(?![\d:])/))) {
      let iso = validYMD(base.getFullYear(), +m[1], +m[2]);
      // 연도 없는 날짜가 두 달 이상 지난 날이면 내년으로 봄 (예: 12월에 받은 "1월 5일")
      if (iso && diffDays(baseISO, iso) < -60) iso = validYMD(base.getFullYear() + 1, +m[1], +m[2]);
      if (iso) return { iso, raw: m[0] };
    }
    if ((m = line.match(/(이번|다음)\s*주\s*([월화수목금토일])요일/))) {
      const monday = addDays(baseISO, -((base.getDay() + 6) % 7));
      const iso = addDays(monday, (m[1] === '다음' ? 7 : 0) + (DOW[m[2]] + 6) % 7);
      return { iso, raw: m[0] };
    }
    if ((m = line.match(/오늘|내일|모레/))) {
      return { iso: addDays(baseISO, { '오늘': 0, '내일': 1, '모레': 2 }[m[0]]), raw: m[0] };
    }
    return null;
  }
  function findTime(line) {
    let m;
    if ((m = line.match(/(오전|오후)?\s*(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분|(반))?/))) {
      let h = +m[2];
      const min = m[3] ? +m[3] : m[4] ? 30 : 0;
      if (m[1] === '오후' && h < 12) h += 12;
      if (m[1] === '오전' && h === 12) h = 0;
      if (h <= 23 && min <= 59) return { time: pad(h) + ':' + pad(min), raw: m[0] };
    }
    if ((m = line.match(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/))) return { time: pad(+m[1]) + ':' + m[2], raw: m[0] };
    return null;
  }
  function cleanTitle(line, raws) {
    let t = line;
    raws.forEach(r => { if (r) t = t.replace(r, ' '); });
    t = t.replace(/\((월|화|수|목|금|토|일)\)/g, ' ')
      .replace(/^\s*(\d+[.)]|[-*•·]|[가-하][.)])\s*/, '')
      .replace(/^(일시|일정|날짜|시간|기한|언제)\s*[:：]?\s*/, '')
      .replace(/(까지|부터|에|에서)\s*$/, '')
      .replace(/\s*[:：]\s*$/, '')
      .replace(/\s+/g, ' ').trim();
    return t.length > 40 ? t.slice(0, 40) + '…' : t;
  }
  function parseSchedule(text, baseISO) {
    baseISO = baseISO || todayISO();
    const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    let subject = '';
    for (const l of lines) {
      const m = l.match(/^(제목|Subject|건명)\s*[:：]\s*(.+)$/i);
      if (m) { subject = m[2].trim(); break; }
    }
    const out = [], seen = new Set();
    lines.forEach(line => {
      if (/^(제목|Subject|건명)\s*[:：]/i.test(line)) return;
      const d = findDate(line, baseISO);
      if (!d) return;
      const t = findTime(line);
      let title = cleanTitle(line, [d.raw, t && t.raw]);
      if (title.length < 2) title = subject || '새 일정';
      const key = d.iso + (t ? t.time : '') + title;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ date: d.iso, time: t ? t.time : '', title });
    });
    return out;
  }

  OB.core = {
    esc, uid, toISO, parseISO, todayISO, addDays, diffDays, isValidISO, fmtDate, WEEK,
    defaultState, load, save, reset,
    periodOf, dday, ddayLabel, workItems, courses, regionItems, progress, pct,
    parseSchedule
  };
})();
