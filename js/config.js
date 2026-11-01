// 운영 설정 — 운영 전환 시 이 파일의 값만 바꾸면 됩니다.
window.OB = window.OB || {};

OB.config = {
  STORAGE_KEY: 'powercat-onboarding-v3',

  // D-01: 기본 온보딩 기간(일). 관리자 화면에서 개인별로 바꿀 수 있음
  DEFAULT_PERIOD_DAYS: 90,

  // Q-03: 사번 형식 (임시 규칙)
  EMP_ID_PATTERN: /^\d{8}$/,
  EMP_ID_HINT: '숫자 8자리',

  // D-02: 카테고리 가중치 (합계 1)
  WEIGHTS: { work: 0.4, edu: 0.4, region: 0.2 },

  // EDU-03: 마감 며칠 전부터 팀장 알림 대상인지
  ALERT_DAYS_BEFORE: 7,

  // Q-26: 관리자 임시 PIN (2단계에서 SSO 역할 권한으로 교체)
  ADMIN_PIN: '0000',

  // 사내 AI 게이트웨이 주소. 비어 있으면 브라우저 안에서 시연 응답을 사용 (외부 전송 없음)
  // 요청 형식: POST { task: 'ocr' | 'draft' | 'verify', payload } → 응답 { text } 또는 { items }
  AI_ENDPOINT: '',

  // 시연용 사전 생성 추천(공문 DB 기반, 팀 Supabase "Newcommers' Dashboard"). 사무(경영지원) 직무에만 쓰이고,
  // 실패하거나 비어 있으면 기존 더미 추천으로 돌아간다. AI_ENDPOINT(사내 AI: OCR·초안·검증)와 섞지 말 것.
  // anon(공개) 키는 브라우저에 노출돼도 되는 값. 서비스 키(service_role)는 절대 넣지 않는다.
  // 출처: 팀 Drive 20261029_SEW_AI추천일정모듈 (v1_app_config_추가분.js)
  RECOMMEND_ENDPOINT: 'https://rfvkrppguehzkxxmojnr.supabase.co/functions/v1/recommend',
  RECOMMEND_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmdmtycHBndWVoemt4eG1vam5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwODc4MDUsImV4cCI6MjEwODY2MzgwNX0.Cgi5NLs1pZtWH41m7Kz-3LjLd-2OsvmklTJSsLkmzFk',
  RECOMMEND_PERSONA: 'demo-hire', // 시연 인물(대전세종충남본부 사무(경영지원) 신입)
  RECOMMEND_JOB: '사무(경영지원)',

  // Supabase (본부 공유 장소 저장 + 카카오 검색 중계). 비어 있으면 브라우저 저장소만 사용.
  // anon 키는 공개용이라 여기 넣어도 됩니다. service_role 키·카카오 키는 절대 넣지 마세요.
  // 연결 보류 중 (프로젝트 완성 후 연결 예정). 연결 방법: supabase/schema.sql 실행 → place-search 함수 배포 → KAKAO_REST_KEY 등록 → 아래 두 값 입력
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: ''
};
