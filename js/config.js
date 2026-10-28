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
  AI_ENDPOINT: ''
};
