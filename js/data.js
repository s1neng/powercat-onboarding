// 시연용 샘플 데이터 — 2단계에서 인사·교육·영업 시스템 API로 교체 (Q-04, Q-06, Q-08, Q-09, Q-11)
(function () {
  const JOBS = ['사무(영업·요금)', '사무(경영지원)', '배전', '송변전', '전력ICT', '토목·건축'];

  const HQS = {
    '서울본부': ['중부지사', '동부지사', '서부지사', '강북지사'],
    '남서울본부': ['강남지사', '송파지사', '관악지사', '구로지사'],
    '인천본부': ['남인천지사', '부천지사', '김포지사'],
    '경기북부본부': ['의정부지사', '고양지사', '파주지사'],
    '경기본부': ['수원지사', '용인지사', '화성지사', '평택지사'],
    '강원본부': ['춘천지사', '원주지사', '강릉지사'],
    '충북본부': ['청주지사', '충주지사', '제천지사'],
    '대전세종충남본부': ['대전지사', '세종지사', '천안지사', '아산지사'],
    '전북본부': ['전주지사', '익산지사', '군산지사'],
    '광주전남본부': ['광주지사', '목포지사', '순천지사', '여수지사'],
    '대구본부': ['대구지사', '동대구지사', '경산지사'],
    '경북본부': ['포항지사', '구미지사', '안동지사'],
    '부산울산본부': ['부산지사', '동래지사', '울산지사', '해운대지사'],
    '경남본부': ['창원지사', '김해지사', '진주지사'],
    '제주본부': ['제주지사', '서귀포지사']
  };

  // 사업소 지표 (샘플): 이름으로 고정된 값을 만들어 매번 같은 숫자가 나오게 함
  function seed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }
  function officeStats(hq) {
    return (HQS[hq] || []).map(name => {
      const r = seed(hq + name), r2 = seed(name + 'c'), r3 = seed(name + 'u');
      return {
        office: name,
        sales: Math.round(300 + r * 1200),          // 억원 (월)
        customers: Math.round(50000 + r2 * 200000), // 호
        usage: Math.round(400 + r3 * 2100)          // GWh (월)
      };
    });
  }

  // WRK-04 인수인계 체크리스트: 공통 + 직무별
  const HANDOVER_COMMON = [
    { id: 'c1', label: '전임자(또는 사수)와 인수인계 면담' },
    { id: 'c2', label: '담당 업무 분장표·연간 업무 일정 확인' },
    { id: 'c3', label: '업무 시스템 계정·권한 신청 완료' },
    { id: 'c4', label: '진행 중인 업무·미결 문서 목록 인수' }
  ];
  const HANDOVER_JOB = {
    '사무(영업·요금)': ['요금 청구·수납 처리 절차 실습', '주요 고객(대수용가) 목록 인수', '민원 이력·처리 중 건 확인'],
    '사무(경영지원)': ['예산 집행 현황 파일 인수', '계약·구매 진행 건 확인', '인사·복무 처리 일정 확인'],
    '배전': ['담당 배전선로 현황도 확인', '공사 진행 현장 목록 인수', '협력업체 담당자 연락망 확인'],
    '송변전': ['담당 변전소 설비 현황 확인', '정기 점검 계획표 인수', '고장 이력·특이 설비 확인'],
    '전력ICT': ['담당 시스템·서버 목록 인수', '장애 대응 절차서 확인', '유지보수 계약 현황 확인'],
    '토목·건축': ['진행 공사 도면·공정표 인수', '인허가 진행 건 확인', '시설물 점검 대장 확인']
  };
  function handoverFor(job) {
    return HANDOVER_COMMON.concat((HANDOVER_JOB[job] || []).map((label, i) => ({ id: 'j' + (i + 1), label })));
  }

  // EDU-02 필수교육: offset = 입사일로부터 마감까지 일수 (KPI: 이수 시간)
  const COURSES_COMMON = [
    { id: 'law1', name: '청렴·윤리 교육', type: '법정', hours: 2, offset: 14 },
    { id: 'law2', name: '정보보안 교육', type: '법정', hours: 2, offset: 14 },
    { id: 'law3', name: '산업안전보건 교육', type: '법정', hours: 4, offset: 30 },
    { id: 'law4', name: '개인정보보호 교육', type: '법정', hours: 1, offset: 30 },
    { id: 'law5', name: '직장 내 괴롭힘·성희롱 예방 교육', type: '법정', hours: 2, offset: 30 }
  ];
  const COURSE_JOB = {
    '사무(영업·요금)': '전기요금·공급약관 기본과정',
    '사무(경영지원)': '예산·회계 실무 기본과정',
    '배전': '배전설비 운영 기본과정',
    '송변전': '변전설비 운영 기본과정',
    '전력ICT': '전력ICT 시스템 기본과정',
    '토목·건축': '전력시설 토목·건축 기본과정'
  };
  function coursesFor(job) {
    return COURSES_COMMON.concat([{ id: 'job1', name: COURSE_JOB[job] || '직무 기본과정', type: '직무', hours: 8, offset: 60 }]);
  }

  // EDU-04 교육 일정 (입사일 기준)
  const EDU_SCHEDULE = [
    { id: 's1', title: '신입사원 입문교육 (인재개발원)', offset: 7, time: '09:00' },
    { id: 's2', title: '전기안전 체험교육', offset: 21, time: '13:30' },
    { id: 's3', title: '직무 기본과정 집합교육', offset: 45, time: '09:30' },
    { id: 's4', title: '신입사원 수습 평가 면담', offset: 80, time: '15:00' }
  ];

  // WRK-02 AI 추천 근거: 직무별 반복 업무 (Q-06 샘플)
  const JOB_CALENDAR = {
    '사무(영업·요금)': [{ title: '월 요금 청구 마감 점검', day: 25 }, { title: '미수금 현황 보고', day: 5 }, { title: '고객 민원 처리 현황 점검', day: 15 }],
    '사무(경영지원)': [{ title: '월 예산 집행 실적 보고', day: 3 }, { title: '급여·수당 자료 마감', day: 20 }, { title: '계약 진행 현황 점검', day: 12 }],
    '배전': [{ title: '배전선로 순시 점검', day: 10 }, { title: '공사 준공 검사 일정 확인', day: 22 }, { title: '안전작업 TBM 점검', day: 1 }],
    '송변전': [{ title: '변전소 정기 순시', day: 8 }, { title: '설비 점검 결과 보고', day: 18 }, { title: '보호계전기 시험 계획 확인', day: 27 }],
    '전력ICT': [{ title: '시스템 정기 점검', day: 7 }, { title: '보안 취약점 점검 보고', day: 17 }, { title: '백업 상태 확인', day: 28 }],
    '토목·건축': [{ title: '공정 회의', day: 9 }, { title: '시설물 안전 점검', day: 19 }, { title: '기성 검사 서류 확인', day: 26 }]
  };

  // WRK-05 업무검증 근거 (Q-09 샘플 조항)
  const REGULATIONS = [
    { id: 'r1', source: '여비규정', article: '제8조(국내출장)', keywords: ['출장', '여비', '숙박', '교통비', 'KTX'],
      text: '국내출장 시 출장명령을 사전에 받아야 하며, 숙박비는 실비로 상한액 이내에서 지급한다.',
      checks: ['출장 전 출장명령(결재) 받았는지', '숙박비 상한액 초과 여부', '증빙(영수증) 첨부'] },
    { id: 'r2', source: '계약사무처리지침', article: '제12조(수의계약)', keywords: ['계약', '구매', '수의계약', '견적', '발주', '물품'],
      text: '추정가격 2천만원 이하의 물품·용역은 수의계약할 수 있으며, 2인 이상의 견적서를 받아야 한다.',
      checks: ['추정가격 확인 (부가세 제외)', '견적서 2개 이상 확보', '분할 계약 금지 여부'] },
    { id: 'r3', source: '개인정보보호 지침', article: '제5조(수집·이용)', keywords: ['개인정보', '고객정보', '주민번호', '연락처', '명단'],
      text: '개인정보는 목적에 필요한 최소한으로 수집하고, 외부 전송 시 암호화 및 승인을 거친다.',
      checks: ['수집 목적·동의 여부', '외부 메일 전송 시 암호화', '보관 기간 경과 자료 파기'] },
    { id: 'r4', source: '기본공급약관', article: '제14조(전기사용신청)', keywords: ['신규', '전기사용', '신청', '증설', '공급'],
      text: '전기사용 신청은 신청서와 필요서류를 제출받아 접수하며, 공급방안을 검토하여 회신한다.',
      checks: ['필수 서류 접수 여부', '공급 가능 용량 검토', '처리 기한 내 회신'] },
    { id: 'r5', source: '기본공급약관', article: '제68조(요금 조정)', keywords: ['요금', '감면', '조정', '환불', '청구', '복지할인'],
      text: '요금 감면·조정은 대상 요건과 증빙을 확인한 후 처리하며, 소급 적용 기간을 준수한다.',
      checks: ['감면 대상 요건 증빙', '소급 적용 기간', '시스템 처리 후 고객 안내'] },
    { id: 'r6', source: '전기안전작업 지침', article: '제9조(작업 전 안전조치)', keywords: ['작업', '현장', '정전', '활선', '안전', '공사'],
      text: '작업 전 TBM(작업 전 회의)을 실시하고, 2인 1조 작업과 보호구 착용을 확인한다.',
      checks: ['TBM 실시·기록', '2인 1조 편성', '보호구·검전 확인'] },
    { id: 'r7', source: '사무관리 지침', article: '제17조(문서 결재)', keywords: ['공문', '문서', '결재', '시행', '보고서', '기안'],
      text: '문서는 전결 규정에 따른 결재권자의 결재를 받아 시행하며, 시행문은 정해진 서식을 따른다.',
      checks: ['전결 규정상 결재권자', '공문 서식(수신·제목·끝)', '붙임 파일 누락'] },
    { id: 'r8', source: '정보보안 지침', article: '제22조(저장매체)', keywords: ['USB', '외장', '반출', '파일', '보안', '자료 반출'],
      text: '업무자료를 외부 저장매체로 반출할 때에는 보안담당자의 승인을 받고 반출대장에 기록한다.',
      checks: ['보안담당자 승인', '반출대장 기록', '등록된 보안 USB 사용'] },
    { id: 'r9', source: '임직원 행동강령', article: '제14조(금품 수수 금지)', keywords: ['선물', '식사', '접대', '협력업체', '금품', '청탁'],
      text: '직무관련자로부터 금품 등을 받아서는 안 되며, 예외 범위(음식물 3만원 등)를 준수한다.',
      checks: ['직무관련자 해당 여부', '가액 기준 초과 여부', '신고 대상 여부'] },
    { id: 'r10', source: '고객민원 처리 매뉴얼', article: '3장(처리 기한)', keywords: ['민원', '고객', '불만', '응대', '회신'],
      text: '일반 민원은 접수 후 3일 이내 처리하고, 처리 결과를 고객에게 안내한다.',
      checks: ['접수 일시 기록', '3일 이내 처리', '결과 안내 기록'] },
    { id: 'r11', source: '복무규정', article: '제20조(시간외근무)', keywords: ['초과근무', '야근', '휴일근무', '시간외', '연장근무'],
      text: '시간외근무는 사전에 명령을 받아야 하며, 월 한도 시간을 넘을 수 없다.',
      checks: ['사전 명령 여부', '월 한도 확인', '근무 기록 입력'] }
  ];

  // WRK-06 동일분야 담당자 (Q-10: 연락처 미표시)
  const PEOPLE = [
    { id: 'p1', name: '김하늘', job: '사무(영업·요금)', hq: '서울본부', office: '중부지사', years: 6, topic: '요금 청구·민원' },
    { id: 'p2', name: '이도윤', job: '사무(영업·요금)', hq: '경기본부', office: '수원지사', years: 4, topic: '신규 전기사용 접수' },
    { id: 'p3', name: '박서진', job: '사무(영업·요금)', hq: '부산울산본부', office: '울산지사', years: 9, topic: '대수용가 관리' },
    { id: 'p4', name: '최유나', job: '사무(경영지원)', hq: '대전세종충남본부', office: '대전지사', years: 7, topic: '계약·구매' },
    { id: 'p5', name: '정민호', job: '사무(경영지원)', hq: '서울본부', office: '본부 경영지원처', years: 5, topic: '예산·회계' },
    { id: 'p6', name: '한지후', job: '배전', hq: '경기본부', office: '용인지사', years: 8, topic: '배전 공사 감독' },
    { id: 'p7', name: '오세라', job: '배전', hq: '광주전남본부', office: '순천지사', years: 3, topic: '선로 순시·고장 복구' },
    { id: 'p8', name: '윤태경', job: '송변전', hq: '대구본부', office: '대구전력지사', years: 11, topic: '변전소 운영' },
    { id: 'p9', name: '서지민', job: '송변전', hq: '충북본부', office: '청주전력지사', years: 5, topic: '보호계전기' },
    { id: 'p10', name: '강예준', job: '전력ICT', hq: '인천본부', office: 'ICT운영부', years: 6, topic: '시스템 운영' },
    { id: 'p11', name: '임소율', job: '전력ICT', hq: '남서울본부', office: 'ICT운영부', years: 4, topic: '정보보안' },
    { id: 'p12', name: '배준서', job: '토목·건축', hq: '경남본부', office: '건설지원부', years: 10, topic: '송전 토목 공사' },
    { id: 'p13', name: '노은채', job: '토목·건축', hq: '강원본부', office: '건설지원부', years: 3, topic: '사옥 시설 관리' }
  ];

  // HOM-03 동기 (같은 입사일) — Q-24: 서버 없음 → 샘플
  const PEERS = [
    { empId: '20260101', name: '김민준', nickname: '전력질주', hq: '서울본부', job: '배전', progress: 0.72 },
    { empId: '20260102', name: '이서연', nickname: '요금마스터', hq: '경기본부', job: '사무(영업·요금)', progress: 0.45 },
    { empId: '20260103', name: '박지호', nickname: '변전소지킴이', hq: '대구본부', job: '송변전', progress: 0.88 },
    { empId: '20260104', name: '최수아', nickname: '코드한전', hq: '인천본부', job: '전력ICT', progress: 0.31 },
    { empId: '20260105', name: '정우진', nickname: '튼튼설계', hq: '경남본부', job: '토목·건축', progress: 0.57 }
  ];

  // REG-02 본부 공유 목록 (선배 등록분 샘플)
  const SEED_PLACES = [
    { id: 'sp1', type: 'food', name: '사옥 뒤 할매국밥', desc: '점심 회전이 빨라요. 수육국밥 추천', author: '선배 김OO' },
    { id: 'sp2', type: 'food', name: '정문 앞 분식집', desc: '야근할 때 김밥 포장 필수', author: '선배 이OO' },
    { id: 'sp3', type: 'tour', name: '시립 수목원', desc: '주말 산책 코스로 최고, 입장 무료', author: '선배 박OO' },
    { id: 'sp4', type: 'trait', name: '산업단지 밀집 지역', desc: '대수용가 고객이 많아 계약전력 문의가 잦아요', author: '선배 최OO' }
  ];

  // 본부별 실제 추천 목록 (언론 보도·백년가게 지정 기준, 영업 여부·가격은 바뀔 수 있음)
  const SRC_SEOUL = '서울신문 「이우석의 미시 여행」(2022.7)', SRC_DAUM = '「100년 단골 시리즈」 충북 맛집 BEST 5', SRC_TOUR = '충북 대표 관광지', SRC_KEPCO = '한전 전력데이터개방포털 (2026.8 기준)';
  const PLACES_BY_HQ = {
    '충북본부': [
      // ll·addr: 카카오맵 검색 기준(2026.10 확인).
      { id: 'cb1', type: 'food', area: '청주', ll: [36.61944, 127.49594], addr: '충북 청주시 상당구 영운로 43', name: '청남삼겹살', desc: '업력 48년 삼겹살 노포 · 2025 백년가게 지정', author: '중부매일 「충청권 백년가게·백년소공인 14곳 신규 지정」' },
      { id: 'cb2', type: 'food', area: '청주', ll: [36.62926, 127.48519], addr: '충북 청주시 상당구 무심동로304번길 10', name: '남주동해장국', desc: '청주 노포 · 소고기·선지 넣은 매콤한 해장국', author: SRC_SEOUL },
      { id: 'cb3', type: 'food', area: '청주', ll: [36.63270, 127.48568], addr: '충북 청주시 상당구 남사로93번길 17', name: '상주집', desc: '서문동 · 콩가루 입힌 다슬기 올갱이국', author: SRC_SEOUL },
      { id: 'cb4', type: 'food', area: '청주', ll: [36.45816, 127.42847], addr: '충북 청주시 서원구 현도면 청남로 16', name: '금수장장어구이', desc: '3대째 장어구이 · 2018 백년가게 선정', author: '중소벤처기업부 백년가게 (ktriptips 소개)' },
      { id: 'cb5', type: 'food', area: '청주', ll: [36.64887, 127.48599], addr: '충북 청주시 청원구 향군로41번길 11-5', name: '북일정육', desc: '북부시장 30년 정육식당 · 소고기 모둠', author: SRC_DAUM },
      { id: 'cb6', type: 'food', area: '청주', ll: [36.63309, 127.48860], addr: '충북 청주시 상당구 상당로55번길 40-2', name: '공원당', desc: '돈가스·우동 노포 · 충북 백년가게 선정', author: '세종경제뉴스 「청주 공원당, 대동관 등 충북 백년가게 선정」' },
      { id: 'cb7', type: 'food', area: '제천', ll: [37.12818, 128.21319], addr: '충북 제천시 내토로43길 5', name: '노송식당', desc: '생선구이 노포 · 2019 백년가게 인증', author: '온트립 「[백년가게] 노송식당」' },
      { id: 'cb8', type: 'food', area: '옥천', ll: [36.30024, 127.56974], addr: '충북 옥천군 옥천읍 중앙로4길 11', name: '경진각', desc: '옥천읍 가족 중국집 · 불향 가득한 양배추 짬뽕', author: SRC_DAUM },
      { id: 'cb9', type: 'food', area: '진천', ll: [36.94159, 127.40997], addr: '충북 진천군 이월면 화산동길 18', name: '욕쟁이할머니집', desc: '이월저수지 옆 · 가마솥 흑미 오리탕', author: SRC_DAUM },
      { id: 'cb10', type: 'food', area: '괴산', ll: [36.81384, 128.03958], addr: '충북 괴산군 연풍면 새재로 1833', name: '새재황토방', desc: '연풍면 황토집 · 능이 토종닭', author: SRC_DAUM },
      { id: 'cbt1', type: 'tour', area: '청주', ll: [36.46285, 127.49177], addr: '충북 청주시 상당구 문의면 청남대길 646', name: '청남대', desc: '대청호 옆 옛 대통령 별장 · 가을 단풍길', author: SRC_TOUR },
      { id: 'cbt2', type: 'tour', area: '청주', ll: [36.66230, 127.54140], addr: '충북 청주시 상당구 산성동 산 28-2', name: '상당산성', desc: '성곽 한 바퀴 산책 · 산성마을 한정식', author: SRC_TOUR },
      { id: 'cbt3', type: 'tour', area: '청주', ll: [36.65546, 127.49003], addr: '충북 청주시 청원구 상당로 314', name: '국립현대미술관 청주', desc: '옛 연초제조창을 바꾼 수장형 미술관', author: SRC_TOUR },
      { id: 'cbt4', type: 'tour', area: '보은', ll: [36.54172, 127.83296], addr: '충북 보은군 속리산면 법주사로 405', name: '속리산 법주사', desc: '세계유산 산사 · 세조길 걷기', author: SRC_TOUR },
      { id: 'cbt5', type: 'tour', area: '괴산', ll: [36.75348, 127.83344], addr: '충북 괴산군 칠성면 사은리 517', name: '산막이옛길', desc: '괴산호 따라 걷는 숲길', author: SRC_TOUR },
      { id: 'cbt6', type: 'tour', area: '충주', ll: [36.98937, 127.90063], addr: '충북 충주시 칠금동 산 1-1', name: '탄금대', desc: '남한강·달천 합류 지점 공원', author: SRC_TOUR },
      { id: 'cbt7', type: 'tour', area: '제천', ll: [37.17318, 128.21071], addr: '충북 제천시 모산동 241', name: '의림지', desc: '삼한시대 저수지 · 호숫가 산책', author: SRC_TOUR },
      { id: 'cbt8', type: 'tour', area: '단양', ll: [37.00008, 128.34397], addr: '충북 단양군 매포읍 하괴리 산 20-40', name: '도담삼봉', desc: '남한강 위 세 봉우리 · 단양팔경 제1경', author: SRC_TOUR },
      // 지역특성: 한전 개방데이터(2026.8) 수치 + 언론·공공기관 자료
      { id: 'cbr1', type: 'trait', area: '충북', name: '산업용 전력 비중 전국 3위', desc: '사용량의 62.4%가 산업용(전국 45.3%) · 공장·산단 고객의 계약전력 상담이 많아요', author: SRC_KEPCO },
      { id: 'cbr2', type: 'trait', area: '청주', name: '본부 판매수입 절반이 청주', desc: '판매수입 48%·고객 38%가 청주시 · 본부 업무량도 청주에 몰려요', author: SRC_KEPCO },
      { id: 'cbr3', type: 'trait', area: '진천·음성', name: '진천·음성 산업 벨트', desc: '산업용 77%·74%, 고객 1호당 월 3~4천 kWh로 본부 최고 · 혁신도시와 산단 밀집', author: SRC_KEPCO },
      { id: 'cbr4', type: 'trait', area: '청주', name: '오창 이차전지 특화단지', desc: '2023년 국가첨단전략산업 특화단지 지정 · 배터리 공장 증설로 대용량 신규 수요가 늘어요', author: '아주경제·서울신문 보도 (2023~2024)' },
      { id: 'cbr5', type: 'trait', area: '청주', name: '청주 반도체 클러스터', desc: 'SK하이닉스 M15X 등 반도체 팹 · 증설마다 안정적 전력 공급이 핵심 과제', author: 'SK하이닉스 뉴스룸·파이낸셜뉴스 (2024~2026)' },
      { id: 'cbr6', type: 'trait', area: '단양·제천', name: '시멘트 산업 집적지', desc: '전국 시멘트 공장 10곳 중 4곳이 단양·제천 · 단양은 산업용 비중 84%', author: '파이낸셜뉴스(2025) · ' + SRC_KEPCO },
      { id: 'cbr7', type: 'trait', area: '괴산·보은·영동', name: '농사용 전력 비중 높은 군', desc: '괴산·보은·영동은 농사용 23~25% · 양수·건조 등 계절별 농사용 계약이 중요해요', author: SRC_KEPCO },
      { id: 'cbr8', type: 'trait', area: '충주', name: '충주댐 수력발전', desc: '남한강 충주댐 수력 설비 412MW (1985년 준공) · 내륙 충북의 대표 발전원', author: '한국수자원공사(K-water) 수력발전 현황' },
      { id: 'cbr9', type: 'trait', area: '음성', name: '음성 천연가스발전소', desc: '석탄→LNG 연료전환 국내 1호 · 1,122MW(561MW×2) · 중부권 전력 거점', author: '이투데이·KPI뉴스 (동서발전 착공 보도)' },
      { id: 'cbr10', type: 'trait', area: '충북', name: '여름·겨울 두 번의 피크', desc: '8월 2,549GWh·1월 2,453GWh로 봄·가을보다 약 20% 많아요 · 냉난방 수요 대비', author: SRC_KEPCO }
    ]
  };

  // 본부별 지도 영역: 시군 중심 좌표(직접 등록 시 기본 위치)
  const AREAS_BY_HQ = {
    '충북본부': { 청주: [36.6424, 127.4890], 충주: [36.9910, 127.9259], 제천: [37.1326, 128.1910], 보은: [36.4894, 127.7295], 옥천: [36.3064, 127.5714], 영동: [36.1750, 127.7834],
      증평: [36.7853, 127.5815], 진천: [36.8554, 127.4356], 괴산: [36.8153, 127.7866], 음성: [36.9403, 127.6905], 단양: [36.9846, 128.3655] }
  };
  // 본부 목록이 있으면 그 유형은 실제 목록으로, 없는 유형만 샘플로 채운다
  function placesFor(hq) {
    const real = PLACES_BY_HQ[hq] || [];
    const types = new Set(real.map(p => p.type));
    return real.concat(SEED_PLACES.filter(p => !types.has(p.type)));
  }

  const PLACE_TYPES = {
    food: { label: '맛집', icon: '🍚' },
    tour: { label: '관광지', icon: '🏞️' },
    trait: { label: '지역특성', icon: '⚡' }
  };

  // D-04 졸업 선물 (Q-25 샘플)
  const GIFTS = [
    { id: 'g1', name: '커피 쿠폰', desc: '동기·사수와 커피 한 잔', icon: '☕' },
    { id: 'g2', name: '파워캣 굿즈 세트', desc: '인형·텀블러·스티커', icon: '🐱' },
    { id: 'g3', name: '도서 상품권', desc: '직무 도서 한 권', icon: '📚' }
  ];

  OB.data = {
    JOBS, HQS, officeStats, handoverFor, coursesFor, EDU_SCHEDULE, JOB_CALENDAR,
    REGULATIONS, PEOPLE, PEERS, SEED_PLACES, placesFor, AREAS_BY_HQ, PLACE_TYPES, GIFTS
  };
})();
