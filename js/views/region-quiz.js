// 지역 퀴즈: 「OO본부 특징 확인하기」·「시군구별 전력사용량 지표 확인」을 버튼 대신 2문제 퀴즈로 이수.
// 문제와 정답은 화면에 보이는 데이터에서 만들기 때문에 데이터가 갱신돼도 맞게 유지된다.
(function () {
  const K = OB.core, esc = K.esc;
  const num = (v, d) => v.toLocaleString(undefined, { maximumFractionDigits: d == null ? 1 : d });
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const jo = (w, a, b) => ((w.charCodeAt(w.length - 1) - 0xAC00) % 28 ? a : b); // 받침 있으면 a
  // 정답 + 오답 후보에서 겹치지 않게 4개
  // must: 꼭 넣을 오답 (헷갈리기 쉬운 보기)
  const choices = (answer, pool, must) => {
    const wrong = (must || []).filter(x => x !== answer);
    shuffle(pool).forEach(x => { if (x !== answer && !wrong.includes(x)) wrong.push(x); });
    return shuffle([answer].concat(wrong.slice(0, 3)));
  };

  // ---------- 문제 만들기 ----------
  function traitsQuiz(R) {
    const T = OB.regionTraits, t = T.traits(R), me = R.metros.find(m => m.metro === R.metro), name = T.short(R.metro);
    const cntrs = Object.keys(me.byCntr || {}).map(k => ({ k, v: me.byCntr[k].powerUsage / me.powerUsage })).sort((a, b) => b.v - a.v);
    const top = cntrs[0];
    const qs = [{
      q: name + '에서 전력을 가장 많이 쓰는 계약종은 무엇일까요?',
      opts: choices(top.k, ['산업용', '일반용', '주택용', '농사용', '교육용'].concat(cntrs.map(c => c.k))),
      a: top.k,
      why: top.k + jo(top.k, '이', '가') + ' ' + num(top.v * 100) + '%로 가장 커요.',
      hint: '①「어떤 지역일까?」 카드의 계약종 비중을 보세요.'
    }];
    // 두 번째: 전국 평균과 뚜렷하게 다른 지표 (1번 문제와 다른 것)
    const pick = t.find(x => x.lv !== 'mid' && x.key !== top.k) || t.find(x => x.key !== top.k);
    const LV = { high: '전국 평균보다 높아요', mid: '전국 평균과 비슷해요', low: '전국 평균보다 낮아요' };
    qs.push({
      q: name + '의 ' + pick.title + jo(pick.title, '은', '는') + ' 전국 평균과 비교하면 어떨까요?',
      opts: [LV.high, LV.mid, LV.low],
      a: LV[pick.lv],
      why: name + ' ' + pick.fmt(pick.val) + ' · 전국 평균 ' + pick.fmt(pick.nat) + ' · ' + pick.n + '개 시도 중 ' + pick.rank + '위예요.',
      hint: '카드의 「' + pick.title + '」 값을 도트 플롯의 검은 선(전국 평균)을 비교해 보세요.'
    });
    return qs;
  }

  function statsQuiz(rows, unit) {
    const names = rows.map(r => r.office);
    const by = f => rows.slice().sort((a, b) => f(b) - f(a));
    const sales = by(r => r.sales), per = by(r => r.customers ? r.usage / r.customers : 0);
    const perKwh = r => r.usage * 1e6 / r.customers; // GWh → kWh, 호당
    const big = by(r => r.customers)[0];
    return [{
      q: '판매수입이 가장 많은 ' + unit + jo(unit, '은', '는') + ' 어디일까요?',
      opts: choices(sales[0].office, names),
      a: sales[0].office,
      why: sales[0].office + jo(sales[0].office, '이', '가') + ' ' + num(sales[0].sales) + '억원으로 가장 많아요.',
      hint: '②「시군구별 전력사용량 지표」에서 판매수입 탭의 막대를 보세요.'
    }, {
      q: '고객 1호당 전력사용량이 가장 많은 ' + unit + jo(unit, '은', '는') + ' 어디일까요?',
      // 고객이 가장 많은 곳을 오답 후보에 꼭 넣어 '규모'와 '호당'을 구분하게 함
      opts: choices(per[0].office, names, [big.office]),
      a: per[0].office,
      why: per[0].office + jo(per[0].office, '은', '는') + ' 고객 1호당 ' + num(perKwh(per[0]), 0) + ' kWh를 써요. 고객 수(' + big.office + ' ' + num(big.customers, 0) + '호)가 많은 곳과 호당 사용량이 큰 곳은 달라요. 공장이 많은 산업형 지역일수록 호당 사용량이 커요.',
      hint: '전력사용량 ÷ 고객호수로 계산해 보세요. 표에서 두 열을 비교하면 돼요.'
    }];
  }

  // ---------- 팝업 ----------
  function open(kind, ctx, onPass) {
    const qs = kind === 'traits' ? traitsQuiz(ctx.R) : statsQuiz(ctx.rows, ctx.unit);
    const title = kind === 'traits' ? '🧩 ' + ctx.hq + ' 특징 퀴즈' : '🧩 ' + ctx.unit + '별 전력사용량 퀴즈';
    OB.app.modal(title,
      '<p class="small muted">카드 내용을 보고 2문제를 모두 맞히면 이수 완료예요. 틀려도 다시 풀 수 있어요.</p>' +
      '<form id="quizForm" class="quiz">' + qs.map((q, i) =>
        '<fieldset class="qz" data-q="' + i + '"><legend><span class="qz-no">Q' + (i + 1) + '</span> ' + esc(q.q) + '</legend>' +
          '<div class="qz-opts">' + q.opts.map(o => '<label class="qz-opt"><input type="radio" name="q' + i + '" value="' + esc(o) + '"><span>' + esc(o) + '</span></label>').join('') + '</div>' +
          '<p class="qz-fb" aria-live="polite"></p></fieldset>').join('') +
        '<div class="qz-foot"><span class="small muted" id="qzMsg"></span><button class="btn primary" id="qzSubmit">채점하기</button></div>' +
      '</form>', dlg => {
      const f = dlg.querySelector('#quizForm'), msg = dlg.querySelector('#qzMsg');
      let passed = false;
      f.addEventListener('change', e => {
        const fs = e.target.closest('.qz');
        if (fs) { fs.classList.remove('right', 'wrong'); fs.querySelector('.qz-fb').textContent = ''; }
      });
      f.addEventListener('submit', e => {
        e.preventDefault();
        if (passed) { OB.app.closeModal(); return; }
        const ans = qs.map((q, i) => (f.elements['q' + i] || {}).value || '');
        if (ans.some(a => !a)) { msg.textContent = '모든 문제에 답을 골라 주세요.'; return; }
        let right = 0;
        qs.forEach((q, i) => {
          const fs = f.querySelector('[data-q="' + i + '"]'), ok = ans[i] === q.a;
          fs.classList.toggle('right', ok); fs.classList.toggle('wrong', !ok);
          fs.querySelector('.qz-fb').textContent = ok ? '✓ 정답! ' + q.why : '✗ 다시 생각해 보세요. 힌트: ' + q.hint;
          if (ok) right++;
        });
        if (right === qs.length) {
          passed = true;
          f.querySelectorAll('input').forEach(x => { x.disabled = true; });
          msg.textContent = '🎉 모두 맞혔어요! 이수 완료';
          dlg.querySelector('#qzSubmit').textContent = '닫기';
          onPass();
        } else msg.textContent = qs.length - right + '문제를 틀렸어요. 답을 바꿔 다시 채점해 보세요.';
      });
    });
  }

  OB.regionQuiz = { open, traitsQuiz, statsQuiz };
})();
