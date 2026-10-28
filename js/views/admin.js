// ADMIN: 개인별 온보딩 기간 지정, 이수율 현황, 교육 알림 내역, 선물 신청 내역 (임시 PIN, Q-26)
(function () {
  const K = OB.core, D = OB.data, C = OB.config, esc = K.esc;
  const SESSION_KEY = 'powercat-onboarding-v3-admin';

  function authed() { try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return !!OB.app.ui.admin; } }

  function render(state) {
    const back = '<header class="sub-head"><button class="btn ghost back" data-go="home">← 메인</button><h1>관리자</h1><span class="badge">임시 PIN 로그인</span></header>';
    if (!authed()) {
      return back + '<section class="card pin-card"><h2>관리자 확인</h2><form id="pinForm" class="stack"><label>관리자 PIN<input id="pin" type="password" inputmode="numeric" autocomplete="off"></label><button class="btn primary">확인</button></form>' +
        '<p class="small muted">시연용 PIN은 0000 입니다. 운영 시 SSO 역할 권한으로 교체됩니다.</p></section>';
    }
    const u = state.user;
    const rows = (u ? [{ empId: u.empId, name: u.name, hq: u.hq, job: u.job, startDate: u.startDate, progress: K.progress(state).overall, me: true }] : [])
      .concat(D.PEERS.map(x => Object.assign({ startDate: u ? u.startDate : K.todayISO() }, x)));
    const alerts = u ? K.courses(state).filter(c => c.alert) : [];
    const g = state.graduation;

    return back + '<section class="grid">' +
      '<article class="card span12"><div class="card-head wrap"><h2>신입사원 온보딩 현황</h2><span class="small muted">기본 기간 ' + C.DEFAULT_PERIOD_DAYS + '일 · 기간을 바꾸면 목표일이 다시 계산돼요</span></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>사번</th><th>이름</th><th>본부</th><th>직무</th><th>입사일</th><th>온보딩 기간(일)</th><th>목표일</th><th>D-day</th><th>이수율</th></tr></thead><tbody>' +
        rows.map(r => {
          const period = K.periodOf(state, r.empId), target = K.addDays(r.startDate, period);
          return '<tr><td>' + esc(r.empId) + '</td><td>' + esc(r.name) + (r.me ? ' <span class="tag">이 브라우저</span>' : '') + '</td><td>' + esc(r.hq) + '</td><td>' + esc(r.job) + '</td>' +
            '<td>' + (r.me ? '<input type="date" class="mini-in" data-start value="' + r.startDate + '">' : K.fmtDate(r.startDate)) + '</td>' +
            '<td><input type="number" min="7" max="365" class="mini-in" data-period="' + esc(r.empId) + '" value="' + period + '"></td>' +
            '<td>' + K.fmtDate(target) + '</td><td>' + K.ddayLabel(K.diffDays(K.todayISO(), target)) + '</td>' +
            '<td class="rate-cell"><b>' + K.pct(r.progress) + '%</b>' + OB.app.bar(r.progress) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="small muted">동기 데이터는 서버 연동 전 샘플입니다 (Q-24).</p></article>' +
      '<article class="card span6"><div class="card-head"><h2>교육 미이수 팀장 알림</h2></div>' +
        '<h3 class="list-title">자동 산출 알림 대상 (마감 ' + C.ALERT_DAYS_BEFORE + '일 이내·경과)</h3>' +
        (alerts.length ? '<ul class="plain">' + alerts.map(c => '<li>' + esc(u.name) + ' · ' + esc(c.name) + ' · ' + K.fmtDate(c.deadline) + ' <span class="red small">' + K.ddayLabel(c.left) + '</span></li>').join('') + '</ul>' : '<p class="muted small">현재 대상 없음</p>') +
        '<h3 class="list-title">발송 기록</h3>' +
        (state.notifications.length ? '<ul class="plain">' + state.notifications.slice().reverse().map(n => '<li>' + n.at.slice(0, 16).replace('T', ' ') + ' · ' + esc(n.name) + ' · ' + esc(n.courseName) + ' → ' + esc(n.to) + '</li>').join('') + '</ul>' : '<p class="muted small">기록 없음</p>') +
      '</article>' +
      '<article class="card span6"><div class="card-head"><h2>졸업 선물 신청</h2></div>' +
        (g && u ? '<ul class="plain"><li>' + g.at.slice(0, 10) + ' · ' + esc(u.name) + '(' + esc(u.empId) + ') · ' + D.GIFTS.find(x => x.id === g.giftId).icon + ' ' + esc(D.GIFTS.find(x => x.id === g.giftId).name) + '</li></ul>' : '<p class="muted small">신청 없음</p>') +
        '<h3 class="list-title">알림 받을 팀장 메일</h3>' +
        '<form id="leaderForm" class="row gap-s"><input type="email" id="leader" class="grow" placeholder="teamleader@kepco.co.kr" value="' + esc(state.leaderEmail) + '" aria-label="팀장 메일"><button class="btn">저장</button></form>' +
        '<h3 class="list-title">시연 데이터</h3><button class="btn danger small" data-act="wipe">이 브라우저 데이터 초기화</button>' +
      '</article>' +
      '</section>';
  }

  function mount(root) {
    const pin = root.querySelector('#pinForm');
    if (pin) {
      root.querySelector('#pin').focus();
      pin.addEventListener('submit', e => {
        e.preventDefault();
        if (root.querySelector('#pin').value !== C.ADMIN_PIN) { OB.app.toast('PIN이 맞지 않아요'); return; }
        try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (err) { OB.app.ui.admin = true; }
        OB.app.render();
      });
      return;
    }
    root.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.period) {
        const n = Math.round(+t.value);
        if (!(n >= 7 && n <= 365)) { OB.app.toast('기간은 7~365일로 입력해 주세요'); OB.app.render(); return; }
        OB.app.update(st => { st.periods[t.dataset.period] = n; });
        OB.app.toast('온보딩 기간을 ' + n + '일로 저장했어요');
      } else if (t.hasAttribute('data-start') && K.isValidISO(t.value)) {
        OB.app.update(st => { st.user.startDate = t.value; });
        OB.app.toast('입사일을 변경했어요');
      }
    });
    root.querySelector('#leaderForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = root.querySelector('#leader').value.trim();
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { OB.app.toast('메일 주소 형식을 확인해 주세요'); return; }
      OB.app.update(st => { st.leaderEmail = v; });
      OB.app.toast('팀장 메일을 저장했어요');
    });
    root.addEventListener('click', e => {
      if (e.target.closest('[data-act="wipe"]') && confirm('이 브라우저의 온보딩 데이터를 모두 지울까요?')) {
        K.reset(); OB.app.state = K.defaultState(); OB.app.ui = {}; OB.app.go('home');
      }
    });
  }

  OB.views.admin = { render, mount };
})();
