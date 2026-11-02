// [교육 모듈] 데이터 계층 — OB.data 에 교육 관련 항목을 "추가"합니다 (기존 OB.data 를 덮어쓰지 않음)
// 로드 순서: config.js → (호스트) data.js → edu-recommend.js → edu-data.js → core.js → edu-core.js → … → views/edu.js
// 제공: OB.data.GROUPS, OB.data.coursesFor(job), OB.data.PEERS 의 교육 샘플(eduDone) 보강
(function () {
  OB.data = OB.data || {};

  // EDU-02 교육추천 목록 (4구간): 직무 필수 · 직무 선택 · 공통역량 · 법정의무
  //  - 직무 필수/선택·공통역량·입문·채용시 법정교육: 정리된 엑셀(js/edu-recommend.js) 그대로 사용
  //  - 법정의무 중 연간 법정교육(청렴·정보보안 등)은 엑셀에 없어 기존 샘플 유지 (offset = 입사일로부터 마감까지 일수)
  //  - required: 이수율(KPI, 이수 시간)에 반영되는 과정 = 직무 필수 + 법정의무
  //  - preDone : 이번 입사자는 이미 수료한 과정 (신입사원 입문, 채용 시 법정 안전교육)
  const GROUPS = [
    { key: 'jobReq', label: '직무 필수', desc: '직무 수행에 꼭 필요한 과정 · 이수율 반영' },
    { key: 'jobOpt', label: '직무 선택', desc: '담당 업무에 맞춰 골라 듣는 직무 과정' },
    { key: 'common', label: '공통역량', desc: 'AI·문서·기획 등 모든 직무 공통 역량' },
    { key: 'law', label: '법정의무', desc: '법으로 정해진 의무교육 · 이수율 반영' }
  ];
  const LAW_ANNUAL = [ // 엑셀 '채용 시 법정 안전교육'과 겹치는 '산업안전보건 교육' 샘플은 제외
    { id: 'law1', name: '청렴·윤리 교육', hours: 2, offset: 14 },
    { id: 'law2', name: '정보보안 교육', hours: 2, offset: 14 },
    { id: 'law4', name: '개인정보보호 교육', hours: 1, offset: 30 },
    { id: 'law5', name: '직장 내 괴롭힘·성희롱 예방 교육', hours: 2, offset: 30 }
  ];
  const COURSE_JOB_SAMPLE = { // 엑셀 데이터가 없는 직무의 직무 필수 (샘플)
    '배전': '배전설비 운영 기본과정', '송변전': '변전설비 운영 기본과정', '전력ICT': '전력ICT 시스템 기본과정', '토목·건축': '전력시설 토목·건축 기본과정'
  };
  const REQ_KINDS = ['필수', '보직필수']; // 엑셀 '구분' → 직무 필수, 그 밖의 직무 과정(직무연계) → 직무 선택
  const slug = name => 'x:' + name.replace(/\s+/g, '');

  function fromRec(c, group, extra) {
    return Object.assign({
      id: slug(c.name), name: c.name, group, kind: c.kind, hours: c.hours, method: c.method, days: c.days, dept: c.dept,
      months: c.months, dates: c.dates, rank: c.rank, required: group === 'jobReq' || group === 'law', preDone: false
    }, extra);
  }
  function coursesFor(job) {
    const R = (OB.data && OB.data.EDU_REC) || { byJob: {} };
    const mine = R.byJob[job], base = R.byJob['사무(경영지원)'] || { courses: [] };
    const out = [], seen = new Set();
    const push = c => { if (!seen.has(c.id)) { seen.add(c.id); out.push(c); } }; // 같은 과정은 한 번만
    if (mine) {
      mine.courses.filter(c => c.rank < 100).forEach(c => push(fromRec(c, REQ_KINDS.includes(c.kind) ? 'jobReq' : 'jobOpt')));
    } else {
      push({ id: 'job1', name: COURSE_JOB_SAMPLE[job] || '직무 기본과정', group: 'jobReq', kind: '필수', hours: 8, offset: 60, required: true, preDone: false, months: [], dates: [] });
    }
    (mine || base).courses.filter(c => c.rank > 100 && c.rank < 900).forEach(c => push(fromRec(c, 'common')));
    base.courses.filter(c => c.rank >= 900).forEach(c => {
      const law = c.name.includes('법정'); // 채용 시 법정 안전교육 → 법정의무, 신입사원 입문 → 직무 필수(입문)
      push(fromRec(c, law ? 'law' : 'jobReq', { preDone: true, kind: law ? '법정필수' : '입문 필수' }));
    });
    LAW_ANNUAL.forEach(c => push(Object.assign({ group: 'law', kind: '법정', required: true, preDone: false, months: [], dates: [] }, c)));
    return out;
  }

  // 동기 샘플 보강 (동기 카드용): 호스트 PEERS 가 없으면 만들고, 있으면 empId 로 찾아 교육 필드만 더함
  //  eduDone: { 과정id: 'YYYY-MM-DD' }  (과정id = 'x:' + 공백 없앤 과정명, 법정 연간교육은 law1·law2·law4·law5)
  const PEER_EDU = [
    { empId: '20260102', name: '이서연', nickname: '요금 새싹', hq: '경기본부', job: '사무(영업·요금)', progress: 0.45,
      eduDone: { 'law1': '2026-10-08', 'law2': '2026-10-10', 'x:신규보직요금업무:규정': '2026-10-15', 'x:신규보직요금업무:시스템': '2026-10-16', 'x:0.5day시장과요금': '2026-10-22' } },
    { empId: '20260107', name: '윤하린', nickname: '경영지원 새싹', hq: '대전세종충남본부', job: '사무(경영지원)', progress: 0.52,
      eduDone: { 'law1': '2026-10-09', 'x:경영지원기본과정': '2026-10-21', 'x:AI를활용한프로그래밍입문': '2026-10-23' } }
  ];
  const peers = OB.data.PEERS = OB.data.PEERS || [];
  PEER_EDU.forEach(p => {
    const hit = peers.find(x => x.empId === p.empId);
    if (hit) Object.assign(hit, { nickname: p.nickname, eduDone: p.eduDone });
    else peers.push(p);
  });

  OB.data.GROUPS = GROUPS;
  OB.data.coursesFor = coursesFor;
})();
