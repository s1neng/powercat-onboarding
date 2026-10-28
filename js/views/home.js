// HOME: D-day, 목표 이수율, 동기 목록, 카테고리 버튼
(function () {
  const K = OB.core, D = OB.data;

  function tip(state, p) {
    const u = state.user;
    if (p.complete) return '모든 목표를 완수했어요! 졸업 페이지에서 수료증과 선물을 받아 가세요 🎉';
    const alerts = K.courses(state).filter(c => c.alert);
    if (alerts.length) return '"' + alerts[0].name + '" 마감이 ' + (alerts[0].left < 0 ? '지났어요' : alerts[0].left + '일 남았어요') + '. 교육부터 챙겨볼까요?';
    const w = K.workItems(state).find(i => !i.done);
    if (p.work <= p.edu && w) return '업무에서 "' + w.label + '"부터 해 보면 좋아요.';
    const r = K.regionItems(state).find(i => !i.done);
    if (r && p.region < 1 && p.region <= p.work) return u.hq + '의 ' + r.label.replace(' 1곳', '').replace(' 1가지', '') + '을(를) 알려주세요!';
    if (w) return '업무에서 "' + w.label + '"을(를) 진행해 보세요.';
    return '남은 교육을 마무리하면 졸업이에요!';
  }

  function render(state) {
    const u = state.user, p = K.progress(state), d = K.dday(state);
    const peers = D.PEERS;
    const cats = [
      { key: 'work', name: '업무', icon: '💼', desc: '캘린더 · 인수인계 · 업무검증 · AI 초안', r: p.work },
      { key: 'edu', name: '교육', icon: '🎓', desc: '필수교육 이수 · 교육 일정', r: p.edu },
      { key: 'region', name: '지역', icon: '🗺️', desc: '사업소 지표 · 맛집 · 관광지 · 지역특성', r: p.region }
    ];
    return '<header class="top">' +
        '<span class="brand">⚡ 파워캣 온보딩</span>' +
        '<div class="me"><b>' + K.esc(u.nickname) + '</b><span>' + K.esc(u.hq) + ' · ' + K.esc(u.job) + '</span></div>' +
      '</header>' +
      '<section class="hero grid">' +
        '<article class="card dday span4">' +
          '<h2>온보딩 D-day</h2>' +
          '<div class="dday-num ' + (d.left < 0 ? 'over' : '') + '">' + K.ddayLabel(d.left) + '</div>' +
          '<p class="muted">목표일 ' + K.fmtDate(d.target, true) + ' · 총 ' + d.period + '일</p>' +
          OB.app.bar(d.ratio, 'time') +
          '<p class="small muted">' + d.elapsed + '일째 / ' + d.period + '일</p>' +
        '</article>' +
        '<article class="card rate span4">' +
          '<h2>목표 이수율</h2>' +
          '<div class="rate-wrap">' + OB.app.ring(p.overall, 132, '전체') +
            '<ul class="rate-list">' + cats.map(c => '<li><span>' + c.name + ' <em>' + Math.round(OB.config.WEIGHTS[c.key] * 100) + '%</em></span><b>' + K.pct(c.r) + '%</b>' + OB.app.bar(c.r, c.key) + '</li>').join('') + '</ul>' +
          '</div>' +
        '</article>' +
        '<article class="card cat-tip span4">' +
          '<img src="assets/powercat-point.png" alt="" class="tip-cat">' +
          '<div class="tip-bubble"><b>파워캣 한마디</b><p>' + K.esc(tip(state, p)) + '</p></div>' +
        '</article>' +
      '</section>' +
      '<section class="cats">' +
        cats.map(c => '<button class="cat-btn ' + c.key + '" data-go="' + c.key + '">' +
          '<span class="cat-icon">' + c.icon + '</span><span class="cat-name">' + c.name + '</span>' +
          '<span class="cat-desc">' + c.desc + '</span>' + OB.app.bar(c.r, c.key) +
          '<span class="cat-pct">' + K.pct(c.r) + '%</span></button>').join('') +
        '<button class="cat-btn grad ' + (p.complete ? 'open' : 'locked') + '" data-go="graduate">' +
          '<span class="cat-icon">' + (p.complete ? '🎓' : '🔒') + '</span><span class="cat-name">졸업</span>' +
          '<span class="cat-desc">' + (p.complete ? '수료증과 선물이 기다려요!' : '모든 목표를 완수하면 열려요') + '</span></button>' +
      '</section>' +
      '<section class="card peers">' +
        '<div class="card-head"><h2>동기 목록 <small class="muted">' + K.fmtDate(u.startDate) + ' 입사 · ' + (peers.length + 1) + '명</small></h2></div>' +
        '<ul class="peer-list">' +
          '<li class="peer me-row"><span class="avatar">' + K.esc(u.nickname.slice(0, 1)) + '</span>' +
            '<div class="peer-info"><div class="nick-edit"><b>' + K.esc(u.nickname) + '</b> <span class="tag">나</span> <button class="btn ghost small" data-act="nick">대화명 변경</button></div>' +
            '<span class="muted small">' + K.esc(u.name) + ' · ' + K.esc(u.hq) + ' · ' + K.esc(u.job) + '</span></div>' +
            '<div class="peer-rate"><b>' + K.pct(p.overall) + '%</b>' + OB.app.bar(p.overall) + '</div><span class="cheer-count" title="받은 응원">👏 3</span></li>' +
          peers.map(x => '<li class="peer"><span class="avatar">' + K.esc(x.nickname.slice(0, 1)) + '</span>' +
            '<div class="peer-info"><b>' + K.esc(x.nickname) + '</b><span class="muted small">' + K.esc(x.name) + ' · ' + K.esc(x.hq) + ' · ' + K.esc(x.job) + '</span></div>' +
            '<div class="peer-rate"><b>' + K.pct(x.progress) + '%</b>' + OB.app.bar(x.progress) + '</div>' +
            '<button class="btn ghost small cheer" data-cheer="' + x.empId + '" aria-label="' + K.esc(x.nickname) + '에게 응원 보내기">👏 ' + (state.cheers[x.empId] || 0) + '</button></li>').join('') +
        '</ul>' +
      '</section>' +
      '<footer class="foot"><a href="#/admin">관리자</a> · <button class="linklike" data-act="reset">내 정보 다시 입력</button></footer>';
  }

  function mount(root) {
    root.addEventListener('click', e => {
      const ch = e.target.closest('[data-cheer]');
      if (ch) {
        const id = ch.dataset.cheer;
        OB.app.update(st => { st.cheers[id] = (st.cheers[id] || 0) + 1; });
        const peer = D.PEERS.find(x => x.empId === id);
        OB.app.toast(peer.nickname + '님에게 응원을 보냈어요 👏');
        return;
      }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'nick') {
        const u = OB.app.state.user;
        OB.app.modal('대화명 변경', '<form class="stack" id="nickForm"><label>동기들에게 보일 대화명 (2~12자)<input id="nick" maxlength="12" value="' + K.esc(u.nickname) + '"></label><button class="btn primary">저장</button></form>', dlg => {
          const f = dlg.querySelector('#nickForm'), inp = dlg.querySelector('#nick');
          inp.focus(); inp.select();
          f.onsubmit = ev => {
            ev.preventDefault();
            const v = inp.value.trim();
            if (v.length < 2) { OB.app.toast('대화명은 2자 이상이어야 해요'); return; }
            OB.app.update(st => { st.user.nickname = v; });
            OB.app.closeModal();
            OB.app.toast('대화명을 "' + v + '"(으)로 바꿨어요');
          };
        });
      } else if (b.dataset.act === 'reset') {
        if (confirm('이 브라우저에 저장된 온보딩 기록을 모두 지우고 처음부터 다시 입력할까요?')) {
          K.reset();
          OB.app.state = K.defaultState();
          OB.app.ui = {};
          OB.app.go('home');
        }
      }
    });
  }

  OB.views.home = { render, mount };
})();
