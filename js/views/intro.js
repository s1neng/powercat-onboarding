// INTRO: 파워캣이 3D로 등장해 사번·이름·직무·본부·입사일을 차례로 묻는다
(function () {
  const K = OB.core, D = OB.data, C = OB.config;
  const POSE = { hello: 'assets/powercat-hello.png', point: 'assets/powercat-point.png', cheer: 'assets/powercat-cheer.png' };

  const STEPS = [
    { key: 'empId', pose: 'hello', type: 'text', inputmode: 'numeric', placeholder: '사번 (' + C.EMP_ID_HINT + ')',
      q: () => '안녕하세요! 저는 파워캣이에요. 오늘부터 온보딩을 함께할게요. 먼저 사번을 알려주시겠어요?',
      check: v => C.EMP_ID_PATTERN.test(v) ? '' : '사번은 ' + C.EMP_ID_HINT + '로 입력해 주세요.' },
    { key: 'name', pose: 'hello', type: 'text', placeholder: '이름',
      q: () => '고마워요! 이름이 어떻게 되세요?',
      check: v => /^[가-힣a-zA-Z\s]{2,10}$/.test(v) ? '' : '이름은 2~10자의 한글 또는 영문으로 입력해 주세요.' },
    { key: 'job', pose: 'point', type: 'choice', options: () => D.JOBS,
      q: a => a.name + '님, 반가워요! 어떤 직무를 맡으셨나요?' },
    { key: 'hq', pose: 'point', type: 'choice', options: () => Object.keys(D.HQS),
      q: a => a.job + ' 직무시군요. 어느 본부로 발령받으셨어요?' },
    { key: 'startDate', pose: 'hello', type: 'date',
      q: a => a.hq + '! 좋은 곳이에요. 마지막으로, 첫 출근일은 언제인가요?',
      check: v => K.isValidISO(v) ? '' : '날짜를 선택해 주세요.' },
    { key: 'confirm', pose: 'cheer', type: 'confirm',
      q: a => '정리해 볼게요. ' + a.hq + ' ' + a.job + ' ' + a.name + '님, 맞으신가요?' }
  ];

  function ui() {
    const u = OB.app.ui;
    if (!u.intro) u.intro = { started: false, step: 0, answers: { startDate: K.todayISO() }, error: '' };
    return u.intro;
  }

  function render(state) {
    const s = ui();
    const step = STEPS[s.step];
    // 동물의숲 느낌: 하늘·구름·언덕 배경 + 크림색 말풍선 상자 + 이름표
    return '<div class="ac-sky" aria-hidden="true"><i class="cloud c1"></i><i class="cloud c2"></i><i class="cloud c3"></i>' +
        '<div class="hill back"></div><div class="hill front"><i class="flower f1"></i><i class="flower f2"></i><i class="flower f3"></i><i class="flower f4"></i></div></div>' +
      '<section class="intro">' +
      '<div class="intro-top"><span class="ac-pill brand">🍃 파워캣 온보딩</span>' +
      '<button class="ac-pill" data-act="voice">' + (state.voice ? '🔊 소리 켜짐' : '🔇 소리 꺼짐') + '</button></div>' +
      '<div class="stage" id="stage">' +
        '<div class="cat-enter' + (s.started ? ' entered' : '') + (s.entered ? ' done' : '') + '"><div class="cat-float"><div class="cat3d" id="cat3d">' +
          '<img src="' + POSE[step.pose] + '" alt="파워캣" id="catImg">' +
          '<span class="cat-gloss"></span>' +
        '</div></div></div>' +
        '<div class="cat-shadow"></div>' +
      '</div>' +
      (s.started ? dialog(step, s) :
        '<div class="intro-start"><div class="ac-box start-box"><span class="ac-name">파워캣</span><p>앗, 새로운 주민… 아니, 신입사원이다!<br>어서 와요, 환영해요!</p></div>' +
        '<button class="ac-btn" data-act="start">파워캣 만나기 ▶</button></div>') +
      '</section>';
  }

  function dialog(step, s) {
    const a = s.answers;
    const done = STEPS.slice(0, s.step).filter(x => x.key !== 'confirm')
      .map(x => '<span class="ac-tag">' + K.esc(x.key === 'startDate' ? K.fmtDate(a[x.key]) : a[x.key]) + '</span>').join('');
    let input = '';
    if (step.type === 'text') {
      input = '<form class="answer" data-form="text"><input id="ans" type="text" autocomplete="off" ' + (step.inputmode ? 'inputmode="' + step.inputmode + '" ' : '') +
        'placeholder="' + K.esc(step.placeholder) + '" value="' + K.esc(a[step.key] || '') + '" aria-label="' + K.esc(step.placeholder) + '"><button class="ac-btn">다음 ▶</button></form>';
    } else if (step.type === 'date') {
      input = '<form class="answer" data-form="text"><input id="ans" type="date" value="' + K.esc(a.startDate) + '" aria-label="입사일"><button class="ac-btn">다음 ▶</button></form>';
    } else if (step.type === 'choice') {
      input = '<div class="choices">' + step.options().map(o => '<button class="choice' + (a[step.key] === o ? ' on' : '') + '" data-choice="' + K.esc(o) + '">' + K.esc(o) + '</button>').join('') + '</div>';
    } else {
      input = '<dl class="summary">' +
        '<dt>사번</dt><dd>' + K.esc(a.empId) + '</dd><dt>이름</dt><dd>' + K.esc(a.name) + '</dd>' +
        '<dt>직무</dt><dd>' + K.esc(a.job) + '</dd><dt>본부</dt><dd>' + K.esc(a.hq) + '</dd>' +
        '<dt>입사일</dt><dd>' + K.fmtDate(a.startDate, true) + '</dd></dl>' +
        '<div class="choices confirm"><button class="choice" data-act="finish">맞아요, 시작할래요!</button><button class="choice" data-act="restart">다시 할게요</button></div>';
    }
    return '<div class="dialog">' +
      '<div class="ac-box" aria-live="polite"><span class="ac-name">파워캣</span><p class="ac-text"><span id="say"></span></p><i class="ac-next">▼</i></div>' +
      (done ? '<div class="answers">' + done + '</div>' : '') +
      '<div class="input-zone">' + input + (s.error ? '<p class="err">' + K.esc(s.error) + '</p>' : '') + '</div>' +
      '<div class="steps">' + STEPS.map((x, i) => '<i class="' + (i < s.step ? 'done' : i === s.step ? 'now' : '') + '">🍃</i>').join('') +
      (s.step > 0 && step.type !== 'confirm' ? '<button class="ac-pill small" data-act="back">◀ 이전</button>' : '') + '</div>' +
      '</div>';
  }

  // 동물의숲식 웅얼거리는 소리: 글자마다 짧은 음을 높낮이를 바꿔 냄
  let audio;
  function blip(ch) {
    if (!OB.app.state.voice || /\s|[.,!?~…]/.test(ch)) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
      o.type = 'triangle';
      o.frequency.value = 520 + (ch.charCodeAt(0) % 9) * 45 + Math.random() * 40;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g).connect(audio.destination);
      o.start(t); o.stop(t + 0.08);
    } catch (e) { }
  }

  // 말풍선 타이핑 + 말하는 동안 바운스
  let typing;
  function say(root, text) {
    const el = root.querySelector('#say'), cat = root.querySelector('#cat3d'), box = root.querySelector('.ac-box');
    if (!el) return;
    clearInterval(typing);
    const s = ui();
    if (s.spoken === s.step) { el.textContent = text; box.classList.add('typed'); return; } // 재렌더 시 다시 타이핑하지 않음
    s.spoken = s.step;
    let i = 0;
    cat.classList.add('talking');
    typing = setInterval(() => {
      el.textContent = text.slice(0, ++i);
      blip(text[i - 1]);
      if (i >= text.length) { clearInterval(typing); cat.classList.remove('talking'); box.classList.add('typed'); }
    }, 45);
  }

  // 마우스·기기 기울기에 따라 3D 회전
  function tilt(root) {
    const stage = root.querySelector('#stage'), cat = root.querySelector('#cat3d');
    const set = (x, y) => { cat.style.setProperty('--ry', (x * 18).toFixed(1) + 'deg'); cat.style.setProperty('--rx', (-y * 12).toFixed(1) + 'deg'); };
    root.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      set(Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / r.width)), Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / r.height)));
    });
    root.addEventListener('pointerleave', () => set(0, 0));
    if (window.DeviceOrientationEvent) {
      const onTilt = e => { if (e.gamma != null) set(Math.max(-1, Math.min(1, e.gamma / 30)), Math.max(-1, Math.min(1, (e.beta - 45) / 30))); };
      window.removeEventListener('deviceorientation', OB.app.ui.introTilt || onTilt);
      OB.app.ui.introTilt = onTilt;
      window.addEventListener('deviceorientation', onTilt);
    }
  }

  function next(value) {
    const s = ui(), step = STEPS[s.step];
    const v = String(value == null ? '' : value).trim();
    const err = step.check ? step.check(v) : (v ? '' : '선택해 주세요.');
    if (err) { s.error = err; OB.app.render(); return; }
    s.answers[step.key] = v;
    s.error = '';
    s.step++;
    OB.app.render();
  }

  function mount(root, state) {
    const s = ui();
    tilt(root);
    if (s.started) {
      s.entered = true; // 등장 애니메이션은 처음 한 번만
      say(root, STEPS[s.step].q(s.answers));
      const inp = root.querySelector('#ans');
      if (inp) inp.focus();
    }
    root.addEventListener('submit', e => {
      e.preventDefault();
      next(root.querySelector('#ans').value);
    });
    root.addEventListener('click', e => {
      const c = e.target.closest('[data-choice]');
      if (c) { next(c.dataset.choice); return; }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'start') { s.started = true; OB.app.render(); }
      else if (act === 'voice') OB.app.update(st => { st.voice = !st.voice; if (!st.voice && window.speechSynthesis) speechSynthesis.cancel(); });
      else if (act === 'back') { s.step--; s.error = ''; OB.app.render(); }
      else if (act === 'restart') { s.step = 0; s.spoken = -1; OB.app.render(); }
      else if (act === 'finish') {
        const a = s.answers;
        OB.app.update(st => {
          st.user = { empId: a.empId, name: a.name, job: a.job, hq: a.hq, startDate: a.startDate, nickname: a.name };
        }, { render: false });

        OB.app.ui.intro = null;
        OB.app.go('home');
      }
    });
  }

  OB.views.intro = { render, mount };
})();
