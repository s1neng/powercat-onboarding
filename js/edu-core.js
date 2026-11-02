// [교육 모듈] 계산 로직 — OB.core 에 nextOpen · courses · eduRatio 를 추가합니다
// 필요: OB.config.ALERT_DAYS_BEFORE, OB.data.coursesFor, OB.core 의 날짜 함수(toISO·parseISO·todayISO·addDays·diffDays)
// 호스트의 이수율 계산에서 교육 비율은 OB.core.eduRatio(state) 를 쓰면 됩니다 (직무 필수 + 법정의무, 이수 시간 기준)
(function () {
  const C = OB.config, K = OB.core;
  const { toISO, parseISO, todayISO, addDays, diffDays } = K;

  // 엑셀 개설월·개설일로 '다음 개설 예정일' 계산: today 이후 가장 가까운 개설월, 날짜는 최근 실적의 같은 월 개설일
  function nextOpen(c, today) {
    today = today || todayISO();
    if (!c.months || !c.months.length) return null;
    const t = parseISO(today);
    for (let i = 0; i < 13; i++) {
      const y = t.getFullYear() + Math.floor((t.getMonth() + i) / 12), m = (t.getMonth() + i) % 12 + 1;
      if (!c.months.includes(m)) continue;
      const same = (c.dates || []).filter(d => +d.slice(5, 7) === m).sort();
      const day = same.length ? +same[same.length - 1].slice(8, 10) : 1;
      const iso = toISO(new Date(y, m - 1, Math.min(day, new Date(y, m, 0).getDate())));
      if (iso >= today) return iso;
    }
    return null;
  }
  function courses(state, today) {
    today = today || todayISO();
    return OB.data.coursesFor(state.user.job).map(c => {
      const deadline = c.offset != null ? addDays(state.user.startDate, c.offset) : null; // 마감이 정해진 과정(법정 연간교육 등)
      const doneAt = c.preDone ? 'pre' : (state.edu.done[c.id] || null);
      const left = deadline ? diffDays(today, deadline) : null;
      const next = nextOpen(c, today);
      return Object.assign({}, c, {
        deadline, doneAt, left, next, nextLeft: next ? diffDays(today, next) : null,
        alert: !!(c.required && deadline && !doneAt && left <= C.ALERT_DAYS_BEFORE) // 마감 임박 또는 지남
      });
    });
  }

  // 교육 이수율(0~1) = 이수한 필수 과정 시간 / 필수 과정 전체 시간 (필수 = 직무 필수 + 법정의무, 입사 시 수료 포함)
  function eduRatio(state, today) {
    const cs = courses(state, today).filter(c => c.required);
    const total = cs.reduce((a, c) => a + c.hours, 0);
    return total ? cs.filter(c => c.doneAt).reduce((a, c) => a + c.hours, 0) / total : 0;
  }

  Object.assign(K, { nextOpen, courses, eduRatio });
})();
