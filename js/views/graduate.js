// GRADUATE: 전체 이수 시 졸업 축하, 디지털 수료증(PNG), 선물 선택
(function () {
  const K = OB.core, D = OB.data, esc = K.esc;

  function render(state) {
    const p = K.progress(state), u = state.user;
    if (!p.complete) {
      const left = []
        .concat(K.workItems(state).filter(i => !i.done).map(i => ['업무', i.label]))
        .concat(K.courses(state).filter(c => !c.doneAt).map(c => ['교육', c.name]))
        .concat(K.regionItems(state).filter(i => !i.done).map(i => ['지역', i.label]));
      return OB.app.header('졸업', null) +
        '<section class="card locked-grad"><div class="lock">🔒</div><h2>아직 졸업 전이에요</h2>' +
        '<p>전체 이수율 <b>' + K.pct(p.overall) + '%</b> — 남은 항목 ' + left.length + '개를 마치면 졸업 페이지가 열려요.</p>' +
        '<ul class="left-list">' + left.map(([c, l]) => '<li><span class="tag">' + c + '</span> ' + esc(l) + '</li>').join('') + '</ul></section>';
    }
    const g = state.graduation;
    return '<canvas id="confetti" aria-hidden="true"></canvas>' +
      OB.app.header('졸업', null) +
      '<section class="grad-hero"><img src="assets/powercat-cheer.png" alt="응원하는 파워캣" class="grad-cat">' +
        '<div><h2>' + esc(u.name) + '님, 온보딩 졸업을 축하해요! 🎉</h2><p>업무·교육·지역 목표를 모두 완수했어요. 이제 진짜 한전인이에요!</p></div></section>' +
      '<section class="grid">' +
        '<article class="card span7"><div class="card-head"><h2>디지털 수료증</h2><button class="btn primary small" data-act="download">PNG 저장</button></div>' +
          '<canvas id="cert" width="1200" height="850" class="cert"></canvas></article>' +
        '<article class="card span5"><div class="card-head"><h2>졸업 선물 고르기</h2></div>' +
          (g ? '<div class="gift-done"><span>' + D.GIFTS.find(x => x.id === g.giftId).icon + '</span><p><b>' + esc(D.GIFTS.find(x => x.id === g.giftId).name) + '</b> 신청 완료</p><p class="small muted">' + K.fmtDate(g.at.slice(0, 10)) + ' 신청 · 담당자가 전달해 드려요</p><button class="btn ghost small" data-act="regift">다시 고르기</button></div>' :
            '<div class="gifts">' + D.GIFTS.map(x => '<label class="gift"><input type="radio" name="gift" value="' + x.id + '"><span class="gift-icon">' + x.icon + '</span><b>' + esc(x.name) + '</b><span class="small muted">' + esc(x.desc) + '</span></label>').join('') + '</div>' +
            '<button class="btn primary" data-act="gift">선물 신청</button><p class="small muted">신청 내역은 관리자 화면에 기록되고, 팀장님께 보낼 메일 작성창이 열려요.</p>') +
        '</article>' +
      '</section>';
  }

  function drawCert(cv, state) {
    const u = state.user, d = K.dday(state), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    const font = (w, s) => w + ' ' + s + 'px "Pretendard","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#0b3a75'; ctx.lineWidth = 14; ctx.strokeRect(30, 30, W - 60, H - 60);
    ctx.strokeStyle = '#f5b800'; ctx.lineWidth = 4; ctx.strokeRect(54, 54, W - 108, H - 108);
    ctx.textAlign = 'center'; ctx.fillStyle = '#0b3a75';
    ctx.font = font('800', 76); ctx.fillText('수 료 증', W / 2, 190);
    ctx.font = font('500', 26); ctx.fillStyle = '#5a6475'; ctx.fillText('CERTIFICATE OF ONBOARDING', W / 2, 235);
    ctx.textAlign = 'left'; ctx.fillStyle = '#1b2333'; ctx.font = font('600', 30);
    [['성      명', u.name], ['사      번', u.empId], ['소      속', u.hq], ['직      무', u.job], ['온보딩 기간', K.fmtDate(u.startDate) + ' ~ ' + K.fmtDate(d.target) + ' (' + d.period + '일)']]
      .forEach(([k, v], i) => { ctx.fillStyle = '#5a6475'; ctx.fillText(k, 250, 330 + i * 52); ctx.fillStyle = '#1b2333'; ctx.fillText(v, 470, 330 + i * 52); });
    ctx.textAlign = 'center'; ctx.font = font('500', 30); ctx.fillStyle = '#1b2333';
    ctx.fillText('위 사람은 신입사원 온보딩 과정의 업무·교육·지역 목표를', W / 2, 640);
    ctx.fillText('모두 성실히 완수하였으므로 이 증서를 수여합니다.', W / 2, 684);
    const t = K.parseISO(K.todayISO());
    ctx.font = font('600', 28); ctx.fillText(t.getFullYear() + '년 ' + (t.getMonth() + 1) + '월 ' + t.getDate() + '일', W / 2, 745);
    ctx.font = font('800', 32); ctx.fillStyle = '#0b3a75'; ctx.fillText('한국전력공사 ' + u.hq + '장', W / 2, 790);
    // file:// 로 열면 이미지가 캔버스를 오염시켜 PNG 저장이 막히므로 그때는 파워캣 도장을 생략
    if (location.protocol === 'file:') return;
    const img = new Image();
    img.onload = () => {
      ctx.save(); ctx.beginPath(); ctx.arc(1010, 210, 90, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(img, 920, 120, 180, 180); ctx.restore();
      ctx.strokeStyle = '#f5b800'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(1010, 210, 90, 0, Math.PI * 2); ctx.stroke();
    };
    img.src = 'assets/powercat-cheer.png';
  }

  function confetti(cv) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const colors = ['#f5b800', '#0b5cad', '#ff7a59', '#2bb673', '#8f6bff'];
    const parts = Array.from({ length: 140 }, () => ({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height, r: 4 + Math.random() * 6, vy: 2 + Math.random() * 3, vx: -1 + Math.random() * 2, c: colors[Math.random() * 5 | 0], a: Math.random() * 6 }));
    let frames = 0;
    (function tick() {
      if (!cv.isConnected || frames++ > 360) { ctx.clearRect(0, 0, cv.width, cv.height); return; }
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts.forEach(p => { p.y += p.vy; p.x += p.vx; p.a += 0.1; ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); ctx.restore(); });
      requestAnimationFrame(tick);
    })();
  }

  function mount(root, state) {
    if (!K.progress(state).complete) return;
    const cert = root.querySelector('#cert');
    drawCert(cert, state);
    if (!OB.app.ui.celebrated) { OB.app.ui.celebrated = true; confetti(root.querySelector('#confetti')); OB.app.speak('졸업을 축하해요!'); }
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const u = OB.app.state.user;
      if (b.dataset.act === 'download') {
        const a = document.createElement('a');
        a.download = '온보딩수료증_' + u.name + '.png';
        a.href = cert.toDataURL('image/png');
        a.click();
      } else if (b.dataset.act === 'gift') {
        const pick = root.querySelector('[name=gift]:checked');
        if (!pick) { OB.app.toast('선물을 하나 골라 주세요'); return; }
        const gift = D.GIFTS.find(x => x.id === pick.value);
        OB.app.update(st => { st.graduation = { giftId: gift.id, at: new Date().toISOString() }; });
        OB.app.toast(gift.name + ' 신청 완료! 메일 작성창을 엽니다');
        OB.app.mailto('[온보딩] ' + u.name + ' 졸업 및 선물 신청',
          '팀장님, 안녕하십니까.\n\n' + u.hq + ' ' + u.job + ' ' + u.name + '(' + u.empId + ')이(가) 신입사원 온보딩 목표를 모두 완수했습니다.\n\n- 선택한 졸업 선물: ' + gift.name + '\n\n전달 부탁드립니다. 감사합니다.\n\n파워캣 온보딩 시스템');
      } else if (b.dataset.act === 'regift') {
        OB.app.update(st => { st.graduation = null; });
      }
    });
  }

  OB.views.graduate = { render, mount };
})();
