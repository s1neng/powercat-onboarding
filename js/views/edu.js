// EDU: 교육 이수율(이수 시간 기준), 필수교육 목록·팀장 알림, 교육 일정
(function () {
  const K = OB.core, D = OB.data, esc = K.esc;

  function render(state) {
    const p = K.progress(state), cs = K.courses(state), u = state.user;
    const total = cs.reduce((a, c) => a + c.hours, 0), done = cs.filter(c => c.doneAt).reduce((a, c) => a + c.hours, 0);
    const alerts = cs.filter(c => c.alert);
    const sent = id => state.notifications.some(n => n.courseId === id);
    const today = K.todayISO();
    const schedule = D.EDU_SCHEDULE.map(x => Object.assign({}, x, { date: K.addDays(u.startDate, x.offset) }));

    return OB.app.header('교육', p.edu, 'edu') +
      (alerts.length ? '<div class="alert">⏰ 마감이 ' + OB.config.ALERT_DAYS_BEFORE + '일 이내이거나 지난 미이수 교육이 <b>' + alerts.length + '건</b> 있어요. 팀장님께 자동으로 알림 대상에 올라갑니다.</div>' : '') +
      '<section class="grid">' +
        '<article class="card span4 edu-sum">' +
          '<h2>필수교육 이수 현황</h2>' + OB.app.ring(p.edu, 140, '이수율') +
          '<dl class="kv"><dt>이수 시간</dt><dd><b>' + done + '</b> / ' + total + '시간</dd>' +
          '<dt>법정의무교육</dt><dd>' + cs.filter(c => c.type === '법정' && c.doneAt).length + ' / ' + cs.filter(c => c.type === '법정').length + '과정</dd>' +
          '<dt>직무교육</dt><dd>' + cs.filter(c => c.type === '직무' && c.doneAt).length + ' / ' + cs.filter(c => c.type === '직무').length + '과정</dd></dl>' +
          '<p class="small muted">KPI 연계: 이수율은 과정 수가 아닌 <b>이수 시간</b> 기준이에요. 사내 교육시스템 연동 전까지는 수료 후 직접 체크합니다.</p>' +
        '</article>' +
        '<article class="card span8">' +
          '<div class="card-head"><h2>필수교육 목록</h2><span class="muted small">입사일 기준 마감</span></div>' +
          '<div class="table-wrap"><table class="tbl"><thead><tr><th>과정</th><th>구분</th><th>시간</th><th>마감</th><th>상태</th><th></th></tr></thead><tbody>' +
          cs.map(c => '<tr class="' + (c.alert ? 'warn' : '') + '">' +
            '<td>' + esc(c.name) + '</td><td><span class="tag ' + (c.type === '법정' ? 'law' : '') + '">' + c.type + '</span></td><td>' + c.hours + 'h</td>' +
            '<td>' + K.fmtDate(c.deadline) + ' <span class="small ' + (c.alert ? 'red' : 'muted') + '">' + (c.doneAt ? '' : K.ddayLabel(c.left)) + '</span></td>' +
            '<td>' + (c.doneAt ? '<span class="ok">✅ 이수</span>' : c.left < 0 ? '<span class="red">기한 경과</span>' : '미이수') + '</td>' +
            '<td class="acts">' + (c.doneAt ? '<button class="btn ghost small" data-undo="' + c.id + '">취소</button>' :
              '<button class="btn small primary" data-done="' + c.id + '">이수 완료</button>' +
              (c.alert ? '<button class="btn small ' + (sent(c.id) ? 'ghost' : 'warnbtn') + '" data-notify="' + c.id + '">' + (sent(c.id) ? '알림 재발송' : '팀장 알림') + '</button>' : '')) + '</td></tr>').join('') +
          '</tbody></table></div>' +
        '</article>' +
        '<article class="card span12">' +
          '<div class="card-head"><h2>교육 일정</h2></div>' +
          '<ul class="sched">' + schedule.map(x => {
            const added = state.events.some(e => e.title === x.title && e.date === x.date);
            const past = x.date < today;
            return '<li class="' + (past ? 'past' : '') + '"><div class="sched-date"><b>' + K.parseISO(x.date).getDate() + '</b><span>' + (K.parseISO(x.date).getMonth() + 1) + '월 ' + K.WEEK[K.parseISO(x.date).getDay()] + '</span></div>' +
              '<div class="grow"><b>' + esc(x.title) + '</b><div class="small muted">' + x.time + ' · ' + (past ? '지난 일정' : K.ddayLabel(K.diffDays(today, x.date))) + '</div></div>' +
              '<button class="btn small ' + (added ? 'ghost' : '') + '" data-sched="' + x.id + '"' + (added ? ' disabled' : '') + '>' + (added ? '캘린더에 있음' : '캘린더에 추가') + '</button></li>';
          }).join('') + '</ul>' +
        '</article>' +
      '</section>';
  }

  function notify(c) {
    const st = OB.app.state, u = st.user;
    OB.app.update(s => s.notifications.push({ id: K.uid(), courseId: c.id, courseName: c.name, empId: u.empId, name: u.name, deadline: c.deadline, at: new Date().toISOString(), to: s.leaderEmail || '(미설정)' }));
    OB.app.toast('팀장 알림을 기록했어요. 메일 작성창을 엽니다');
    OB.app.mailto('[온보딩] ' + u.name + ' 필수교육 미이수 알림 - ' + c.name,
      '팀장님, 안녕하십니까.\n\n' + u.hq + ' ' + u.job + ' ' + u.name + '(' + u.empId + ')의 필수교육 이수 현황을 알려드립니다.\n\n' +
      '- 과정: ' + c.name + ' (' + c.hours + '시간)\n- 마감: ' + c.deadline + ' (' + K.ddayLabel(c.left) + ')\n- 상태: 미이수\n\n기한 내 이수하도록 하겠습니다.\n\n파워캣 온보딩 시스템');
  }

  function mount(root, state) {
    root.addEventListener('click', e => {
      let b;
      const find = id => K.courses(OB.app.state).find(c => c.id === id);
      if ((b = e.target.closest('[data-done]'))) {
        const c = find(b.dataset.done);
        OB.app.update(s => { s.edu.done[c.id] = K.todayISO(); });
        OB.app.toast('"' + c.name + '" 이수 완료! +' + c.hours + '시간');
      } else if ((b = e.target.closest('[data-undo]'))) {
        OB.app.update(s => { delete s.edu.done[b.dataset.undo]; });
      } else if ((b = e.target.closest('[data-notify]'))) {
        notify(find(b.dataset.notify));
      } else if ((b = e.target.closest('[data-sched]'))) {
        const x = D.EDU_SCHEDULE.find(i => i.id === b.dataset.sched);
        OB.app.update(s => s.events.push({ id: K.uid(), date: K.addDays(s.user.startDate, x.offset), time: x.time, title: x.title, source: '교육 일정' }));
        OB.app.toast('캘린더에 추가했어요');
      }
    });
  }

  OB.views.edu = { render, mount };
})();
