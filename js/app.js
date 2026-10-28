// 앱 뼈대: 상태, 라우팅, 공통 UI 조각(게이지·토스트·모달·음성)
(function () {
  const K = OB.core;
  const app = {
    state: K.load(),
    ui: {} // 저장하지 않는 화면 상태 (캘린더 보기, 입력 중인 값 등)
  };

  app.update = function (fn, opts) {
    fn(app.state);
    K.save(app.state);
    if (!opts || opts.render !== false) app.render();
  };

  // ---------- 라우팅 ----------
  const ROUTES = ['home', 'work', 'edu', 'region', 'graduate', 'admin'];
  function current() {
    const r = (location.hash || '').replace(/^#\/?/, '');
    if (r === 'admin') return 'admin';
    if (!app.state.user) return 'intro';
    return ROUTES.includes(r) ? r : 'home';
  }
  app.go = function (route) {
    if (location.hash === '#/' + route) app.render();
    else location.hash = '#/' + route;
  };
  app.render = function () {
    const route = current();
    const view = OB.views[route];
    const root = document.getElementById('app');
    const page = document.createElement('main');
    page.className = 'page page-' + route;
    page.innerHTML = view.render(app.state);
    root.replaceChildren(page);
    if (view.mount) view.mount(page, app.state);
    if (app.lastRoute !== route) { window.scrollTo(0, 0); app.lastRoute = route; }
  };
  window.addEventListener('hashchange', () => app.render());

  // ---------- 공통 UI 조각 ----------
  app.ring = function (ratio, size, label) {
    size = size || 120;
    const r = size / 2 - 9, c = 2 * Math.PI * r, p = K.pct(ratio);
    return '<div class="ring" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-track"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-fill" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - p / 100)) + '"/>' +
      '</svg><div class="ring-text"><b>' + p + '<small>%</small></b>' + (label ? '<span>' + K.esc(label) + '</span>' : '') + '</div></div>';
  };
  app.bar = function (ratio, cls) {
    return '<div class="bar ' + (cls || '') + '" role="progressbar" aria-valuenow="' + K.pct(ratio) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + K.pct(ratio) + '%"></i></div>';
  };
  app.header = function (title, ratio, color) {
    return '<header class="sub-head ' + (color || '') + '">' +
      '<button class="btn ghost back" data-go="home" aria-label="메인으로">← 메인</button>' +
      '<h1>' + K.esc(title) + '</h1>' +
      (ratio == null ? '<span></span>' : '<div class="sub-rate"><span>이수율</span><b>' + K.pct(ratio) + '%</b>' + app.bar(ratio) + '</div>') +
      '</header>';
  };
  // data-go 링크는 모든 화면 공통
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-go]');
    if (a) { e.preventDefault(); app.go(a.dataset.go); }
  });

  let toastTimer;
  app.toast = function (msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  };

  app.modal = function (title, bodyHTML, mount) {
    const dlg = document.getElementById('modal');
    dlg.innerHTML = '<div class="modal-head"><h2>' + K.esc(title) + '</h2><button class="btn ghost icon" data-close aria-label="닫기">✕</button></div><div class="modal-body">' + bodyHTML + '</div>';
    dlg.querySelector('[data-close]').onclick = () => dlg.close();
    if (!dlg.open) dlg.showModal();
    if (mount) mount(dlg);
    return dlg;
  };
  app.closeModal = () => { const d = document.getElementById('modal'); if (d.open) d.close(); };

  // 브라우저 음성 (한국어 음성이 있으면 사용)
  app.speak = function (text) {
    if (!app.state.voice || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s.,!?~]/gu, ''));
      u.lang = 'ko-KR'; u.rate = 1.05; u.pitch = 1.35;
      const ko = speechSynthesis.getVoices().find(v => /ko/i.test(v.lang));
      if (ko) u.voice = ko;
      speechSynthesis.speak(u);
    } catch (e) { }
  };

  // 팀장 메일 작성창 (EDU-03, GRD-03)
  app.mailto = function (subject, body) {
    const to = app.state.leaderEmail || '';
    location.href = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  };

  OB.views = OB.views || {};
  OB.app = app;
  document.addEventListener('DOMContentLoaded', () => app.render());
})();
