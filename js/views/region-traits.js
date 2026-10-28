// 지역 특성 비교: 신입사원에게 "우리 지역이 다른 지역과 비교해 어떤 곳인지" 알려준다.
// 1일차 「AI 시대의 데이터 시각화」 실습 2(고객호수-판매량 산점도, 로그 척도)와
// 2일차 「AI 시대 데이터 활용과 조직대응」의 지역 비교·벤치마킹 예제를 적용.
(function () {
  const K = OB.core, esc = K.esc;
  const num = (v, d) => v.toLocaleString(undefined, { maximumFractionDigits: d == null ? 1 : d });
  const SHORT = { '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산',
    '세종특별자치시': '세종', '경기도': '경기', '강원특별자치도': '강원', '충청북도': '충북', '충청남도': '충남', '전북특별자치도': '전북', '전라남도': '전남',
    '전남광주통합특별시': '광주·전남', '경상북도': '경북', '경상남도': '경남', '제주특별자치도': '제주' };
  const short = n => SHORT[n] || n.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/, '');
  const share = (x, c) => x.powerUsage ? ((x.byCntr && x.byCntr[c] ? x.byCntr[c].powerUsage : 0) / x.powerUsage) : 0;
  const perCust = x => x.custCnt ? x.powerUsage / x.custCnt : 0; // kWh/호
  const unitCost = x => x.powerUsage ? x.bill / x.powerUsage : 0; // 원/kWh

  // 값이 클수록 1위
  function rankOf(list, f, target) {
    const sorted = list.slice().sort((a, b) => f(b) - f(a));
    return sorted.indexOf(target) + 1;
  }
  // 순위가 상·하위 1/3이고 전국 평균과 10% 이상 차이 날 때만 '특징'으로 본다 (과장 방지)
  function level(rank, n, diff) {
    const third = Math.ceil(n / 3);
    if (rank <= third && diff >= 1.1) return 'high';
    if (rank > n - third && diff <= 0.9) return 'low';
    return 'mid';
  }

  // ---------- 특성 카드 ----------
  function traits(R) {
    const me = R.metros.find(m => m.metro === R.metro);
    if (!me) return null;
    const all = R.metros, n = all.length;
    const tot = all.reduce((a, m) => ({ custCnt: a.custCnt + m.custCnt, powerUsage: a.powerUsage + m.powerUsage, bill: a.bill + m.bill, byCntr: null }), { custCnt: 0, powerUsage: 0, bill: 0 });
    const natShare = c => all.reduce((a, m) => a + (m.byCntr && m.byCntr[c] ? m.byCntr[c].powerUsage : 0), 0) / tot.powerUsage;
    const defs = [
      { key: '산업용', title: '산업용 전력 비중', val: share(me, '산업용'), nat: natShare('산업용'), fmt: v => num(v * 100) + '%', f: m => share(m, '산업용'),
        say: { high: '공장·산업단지가 많은 지역이에요. 대용량 고객의 계약전력·요금 상담과 설비 증설 문의가 잦을 수 있어요.', mid: '산업과 생활 수요가 고루 섞인 지역이에요.', low: '산업보다 생활·상업 수요 중심의 지역이에요.' } },
      { key: '주택용', title: '주택용 전력 비중', val: share(me, '주택용'), nat: natShare('주택용'), fmt: v => num(v * 100) + '%', f: m => share(m, '주택용'),
        say: { high: '가정 고객 비중이 큰 지역이에요. 요금·복지할인 같은 일반 고객 민원이 업무의 중심이 될 수 있어요.', mid: '가정 고객 비중은 전국 평균 수준이에요.', low: '가정보다 산업·상업 고객 비중이 큰 편이에요.' } },
      { key: '농사용', title: '농사용 전력 비중', val: share(me, '농사용'), nat: natShare('농사용'), fmt: v => num(v * 100) + '%', f: m => share(m, '농사용'),
        say: { high: '농업 지역이 넓어요. 농사용 계약·계절별 수요 변화를 눈여겨보세요.', mid: '농사용 비중은 전국 평균 수준이에요.', low: '도시형 지역이라 농사용 비중이 낮아요.' } },
      { key: 'perCust', title: '고객 1호당 월 사용량', val: perCust(me), nat: perCust(tot), fmt: v => num(v, 0) + ' kWh', f: perCust,
        say: { high: '고객 한 곳당 쓰는 전기가 많아요. 대용량 고객 관리가 중요해요.', mid: '고객당 사용량은 전국 평균 수준이에요.', low: '소규모 고객이 많아 고객당 사용량이 적어요.' } },
      { key: 'unit', title: '평균 판매단가', val: unitCost(me), nat: unitCost(tot), fmt: v => num(v) + ' 원/kWh', f: unitCost,
        say: { high: '전국보다 평균 판매단가가 높은 편이에요. 계약종 구성과 요금제에 따라 달라져요.', mid: '평균 판매단가는 전국 평균 수준이에요.', low: '전국보다 평균 판매단가가 낮은 편이에요. 계약종 구성과 요금제에 따라 달라져요.' } }
    ];
    return defs.map(d => {
      const rank = rankOf(all, d.f, me), diff = d.nat ? d.val / d.nat : 1;
      return Object.assign(d, { rank, n, diff, lv: level(rank, n, diff) });
    });
  }

  // 그래프는 카드 전체 폭을 쓰므로 화면 폭에 맞춰 가로 좌표계를 정함 (글자 크기는 유지, 그림만 가로로 넓어짐)
  const chartW = () => Math.round(Math.max(560, Math.min(1100, (window.innerWidth || 1100) - 120)));

  // ---------- 산점도 (로그-로그, SVG) ----------
  function scatter(points, opts) {
    const W = chartW(), H = 420, P = { l: 68, r: 18, t: 16, b: 50 };
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const lx0 = Math.log10(Math.min(...xs) / 1.4), lx1 = Math.log10(Math.max(...xs) * 1.4);
    const ly0 = Math.log10(Math.min(...ys) / 1.4), ly1 = Math.log10(Math.max(...ys) * 1.4);
    const X = v => P.l + (Math.log10(v) - lx0) / (lx1 - lx0) * (W - P.l - P.r);
    const Y = v => H - P.b - (Math.log10(v) - ly0) / (ly1 - ly0) * (H - P.t - P.b);
    const ticks = (a, b) => { const t = []; for (let e = Math.floor(a); e <= Math.ceil(b); e++) [1, 2, 5].forEach(m => { const v = m * Math.pow(10, e); if (Math.log10(v) >= a && Math.log10(v) <= b) t.push(v); }); return t; };
    const tickFmt = v => v >= 1e6 ? num(v / 1e6, 1) + 'M' : v >= 1e3 ? num(v / 1e3, 0) + 'K' : num(v, 0);
    let g = '';
    ticks(lx0, lx1).forEach(v => { g += '<line class="sc-grid" x1="' + X(v) + '" x2="' + X(v) + '" y1="' + P.t + '" y2="' + (H - P.b) + '"/><text class="sc-tick" x="' + X(v) + '" y="' + (H - P.b + 19) + '" text-anchor="middle">' + tickFmt(v) + '</text>'; });
    ticks(ly0, ly1).forEach(v => { g += '<line class="sc-grid" x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="sc-tick" x="' + (P.l - 7) + '" y="' + (Y(v) + 5) + '" text-anchor="end">' + tickFmt(v / opts.yDiv) + '</text>'; });
    // 기준선: 평균 호당 사용량(y = k·x) — 위쪽은 고객당 사용량이 큰 '산업형'
    const k = opts.refPerCust, xa = Math.pow(10, lx0), xb = Math.pow(10, lx1);
    g += '<line class="sc-ref" x1="' + X(xa) + '" y1="' + Y(xa * k) + '" x2="' + X(xb) + '" y2="' + Y(xb * k) + '"/>';
    g += '<text class="sc-ref-t" x="' + (W - P.r - 4) + '" y="' + (Math.max(P.t + 12, Y(xb * k) - 6)) + '" text-anchor="end">' + esc(opts.refLabel) + '</text>';
    // 라벨 겹침 피하기: 오른쪽 → 왼쪽 → 위 → 아래 순으로 놓아 보고, 다른 라벨·점과 안 겹치는 첫 자리에 둠
    const FS = 13.8, lw = s => [...s].reduce((a, ch) => a + (/[가-힣]/.test(ch) ? FS : FS * 0.6), 0), lh = FS + 2;
    const dots = points.map(p => ({ x: X(p.x), y: Y(p.y) }));
    const hit = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
    const placed = [];
    const labelPos = (cx, cy, w) => {
      const cand = [
        { x: cx + 11, y: cy + 5, a: 'start', box: { x1: cx + 10, x2: cx + 10 + w, y1: cy - lh / 2, y2: cy + lh / 2 } },
        { x: cx - 11, y: cy + 5, a: 'end', box: { x1: cx - 10 - w, x2: cx - 10, y1: cy - lh / 2, y2: cy + lh / 2 } },
        { x: cx, y: cy - 11, a: 'middle', box: { x1: cx - w / 2, x2: cx + w / 2, y1: cy - 10 - lh, y2: cy - 10 } },
        { x: cx, y: cy + 22, a: 'middle', box: { x1: cx - w / 2, x2: cx + w / 2, y1: cy + 9, y2: cy + 9 + lh } }
      ];
      const ok = c => c.box.x1 >= P.l && c.box.x2 <= W - P.r && !placed.some(b => hit(b, c.box)) &&
        !dots.some(d => hit({ x1: d.x - 7, x2: d.x + 7, y1: d.y - 7, y2: d.y + 7 }, c.box));
      const c = cand.find(ok) || cand[0];
      placed.push(c.box);
      return c;
    };
    points.slice().sort((a, b) => a.hl - b.hl).forEach(p => {
      const cx = X(p.x), cy = Y(p.y), lp = labelPos(cx, cy, lw(p.name));
      g += '<g class="sc-pt' + (p.hl ? ' hl' : '') + '"><title>' + esc(p.name + ' · 고객 ' + num(p.x, 0) + '호 · ' + num(p.y / 1e6) + ' GWh') + '</title>' +
        '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (p.hl ? 8.5 : 6) + '"/>' +
        '<text x="' + lp.x.toFixed(1) + '" y="' + lp.y.toFixed(1) + '" text-anchor="' + lp.a + '">' + esc(p.name) + '</text></g>';
    });
    g += '<text class="sc-axis" x="' + ((W + P.l) / 2) + '" y="' + (H - 6) + '" text-anchor="middle">고객호수 (호, 로그 척도)</text>' +
      '<text class="sc-axis" transform="translate(16 ' + ((H - P.b + P.t) / 2) + ') rotate(-90)" text-anchor="middle">' + esc(opts.yLabel) + '</text>';
    return '<svg class="scatter" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.aria) + '">' + g + '</svg>';
  }

  // ---------- 도트 플롯: 지표별 전국 시도 분포 속 우리 본부 위치 ----------
  const chipW = t => [...t].reduce((a, ch) => a + (/[가-힣★]/.test(ch) ? 11 : 6.4), 0) + 14;
  function dotplot(R, t, hq) {
    // 항목 이름은 두 줄로 나눠 왼쪽 칸을 줄이고 그림 폭을 넓힘
    const W = chartW(), rowH = 92, L = 72, Rp = 14, top = 4, H = top + t.length * rowH;
    const twoLines = s => { const w = s.split(' '); let best = [s, ''], m = Infinity; for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), x = Math.max(a.length, b.length); if (x < m) { m = x; best = [a, b]; } } return best; };
    const me = R.metros.find(m => m.metro === R.metro);
    let g = '';
    t.forEach((ind, i) => {
      const vals = R.metros.map(ind.f), lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.06 || 1;
      const X = v => L + (v - lo + pad) / (hi - lo + 2 * pad) * (W - L - Rp);
      const cy = top + i * rowH + 50, nx = X(ind.nat), mx = X(ind.val);
      const clamp = (x, w) => Math.max(L + w / 2, Math.min(W - Rp - w / 2, x));
      const nm = twoLines(ind.title);
      g += '<text class="dp-name" x="' + (L - 10) + '" y="' + (nm[1] ? cy - 3 : cy + 4) + '" text-anchor="end">' + esc(nm[0]) + (nm[1] ? '<tspan x="' + (L - 10) + '" dy="15">' + esc(nm[1]) + '</tspan>' : '') + '</text>' +
        '<line class="dp-axis" x1="' + L + '" x2="' + (W - Rp) + '" y1="' + cy + '" y2="' + cy + '"/>' +
        // 전국 평균 ↔ 우리 본부 거리
        '<line class="dp-gap" x1="' + nx + '" x2="' + mx + '" y1="' + cy + '" y2="' + cy + '"/>' +
        '<line class="dp-nat" x1="' + nx + '" x2="' + nx + '" y1="' + (cy - 11) + '" y2="' + (cy + 18) + '"/>';
      const nt = '전국 평균 ' + ind.fmt(ind.nat), nw = chipW(nt), ntx = clamp(nx, nw);
      g += '<rect class="dp-nat-chip" x="' + (ntx - nw / 2) + '" y="' + (cy + 19) + '" width="' + nw + '" height="18" rx="9"/>' +
        '<text class="dp-chip-t" x="' + ntx + '" y="' + (cy + 32) + '" text-anchor="middle">' + esc(nt) + '</text>';
      const sorted = R.metros.slice().sort((a, b) => ind.f(a) - ind.f(b));
      sorted.forEach(m => {
        if (m === me) return;
        g += '<g class="dp-pt"><title>' + esc(short(m.metro) + ' ' + ind.title + ': ' + ind.fmt(ind.f(m)) + ' (' + rankOf(R.metros, ind.f, m) + '위)') + '</title>' +
          '<circle class="hit" cx="' + X(ind.f(m)).toFixed(1) + '" cy="' + cy + '" r="11"/><circle cx="' + X(ind.f(m)).toFixed(1) + '" cy="' + cy + '" r="5"/></g>';
      });
      // 양 끝 지역명은 우리 본부 칩과 멀 때만
      [sorted[0], sorted[sorted.length - 1]].forEach(m => {
        if (m !== me && Math.abs(X(ind.f(m)) - mx) > 120) g += '<text class="dp-end" x="' + X(ind.f(m)).toFixed(1) + '" y="' + (cy - 10) + '" text-anchor="middle">' + esc(short(m.metro)) + '</text>';
      });
      const mt = '★ ' + hq + ' ' + ind.fmt(ind.val) + ' · ' + ind.rank + '위', mw = chipW(mt), mtx = clamp(mx, mw);
      g += '<g class="dp-me"><title>' + esc(hq + ' ' + ind.title + ': ' + ind.fmt(ind.val) + ' (' + ind.rank + '위/' + ind.n + ')') + '</title>' +
        '<circle class="dp-halo" cx="' + mx + '" cy="' + cy + '" r="15"/><circle class="dp-dot" cx="' + mx + '" cy="' + cy + '" r="9"/>' +
        '<line class="dp-stem" x1="' + mx + '" x2="' + mx + '" y1="' + (cy - 26) + '" y2="' + (cy - 15) + '"/>' +
        '<rect class="dp-me-chip" x="' + (mtx - mw / 2) + '" y="' + (cy - 46) + '" width="' + mw + '" height="20" rx="10"/>' +
        '<text class="dp-chip-t" x="' + mtx + '" y="' + (cy - 32) + '" text-anchor="middle">' + esc(mt) + '</text></g>';
    });
    return '<svg class="dotplot" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc('지표별 전국 시도 분포와 ' + hq + ' 위치') + '">' + g + '</svg>';
  }

  function cityNote(R) {
    const tot = R.cities.reduce((a, c) => ({ custCnt: a.custCnt + c.custCnt, powerUsage: a.powerUsage + c.powerUsage }), { custCnt: 0, powerUsage: 0 });
    const avg = perCust(tot);
    const above = R.cities.filter(c => perCust(c) > avg * 1.2).sort((a, b) => perCust(b) - perCust(a));
    const below = R.cities.filter(c => perCust(c) < avg * 0.8).sort((a, b) => perCust(a) - perCust(b));
    const ind = c => Math.round(share(c, '산업용') * 100);
    const indRange = list => { const v = list.map(ind); const lo = Math.min(...v), hi = Math.max(...v); return lo === hi ? lo : lo + '~' + hi; };
    return { avg, above, below, ind, indRange };
  }

  const josa = (w, a, b) => ((w.charCodeAt(w.length - 1) - 0xAC00) % 28 ? a : b); // 받침 있으면 a
  const valid = R => R && R.metros && R.metros.length >= 3 && traits(R);

  // 파워캣 요약 문장 (지역 화면 상단 카드에서 사용)
  function lead(R) {
    if (!valid(R)) return '';
    const t = traits(R), me = short(R.metro);
    // 요약은 계약종 구성(산업→주택→농사) 순으로 두드러진 특징 최대 2개
    const picks = t.filter(x => x.lv !== 'mid').slice(0, 2);
    if (!picks.length) return esc(me) + josa(me, '은', '는') + ' 계약종 구성과 사용량이 전국 평균에 가까운 지역이에요.';
    // 문장마다 줄을 나눠 읽기 쉽게
    // 문장 → 근거 수치(작게) → 설명 문장 순, 문장마다 줄바꿈
    const phrase = (x, end) => '<b>' + esc(x.title) + '</b>' + josa(x.title, '이', '가') + ' ' + (x.lv === 'high' ? '높' : '낮') + end;
    const first = esc(me) + josa(me, '은', '는') + ' ' + (picks.length === 2 ? phrase(picks[0], '고') + ', ' + phrase(picks[1], '은') : phrase(picks[0], '은')) + ' 지역이에요.';
    const facts = '<span class="facts">' + picks.map(x => '<span>' + esc(x.key === '산업용' || x.key === '주택용' || x.key === '농사용' ? x.key : x.title) + ' ' + esc(x.fmt(x.val)) + ' · 전국 ' + esc(x.fmt(x.nat)) + ' · ' + x.rank + '위/' + x.n + '</span>').join('') + '</span>';
    return '<span class="sent">' + first + '</span>' + facts + picks[0].say[picks[0].lv].split(/(?<=요\.)\s+/).map(s => '<span class="sent">' + esc(s) + '</span>').join('');
  }

  // footer: 카드 맨 아래에 붙일 HTML (예: 확인 버튼)
  function render(R, footer) {
    if (!valid(R)) return '';
    const t = traits(R);
    const me = short(R.metro), [y, mo] = R.latest.split('-');
    const hq = R.hq || me;
    const cn = cityNote(R);
    const LV = { high: '전국 상위', mid: '전국 평균권', low: '전국 하위' };

    return '<article class="card span12 traits">' +
      '<div class="card-head wrap"><h2>' + esc(me) + josa(me, '은', '는') + ' 어떤 지역일까? <span class="badge live">전국 ' + R.metros.length + '개 시도와 비교 · ' + y + '년 ' + (+mo) + '월</span></h2></div>' +
      '<div class="trait-cards">' + t.map(x => '<div class="trait ' + x.lv + '">' +
        '<span class="tr-title">' + esc(x.title) + '</span><b>' + esc(x.fmt(x.val)) + '</b>' +
        '<span class="tr-cmp">전국 ' + esc(x.fmt(x.nat)) + ' · <em>' + x.rank + '/' + x.n + '위</em> <span class="tr-lv">' + LV[x.lv] + '</span></span>' +
        '<p>' + esc(x.say[x.lv]) + '</p></div>').join('') + '</div>' +
      '<div class="sc-grid2">' +
        '<figure><figcaption class="fig-cap"><span class="fig-no">1</span><span class="fig-txt"><strong>전국 ' + R.metros.length + '개 시·도 속 ' + esc(me) + '의 위치</strong><small class="fig-legend"><i class="lg-dot gray"></i>회색 : 다른 시·도 / <i class="lg-dot orange"></i>주황 : ' + esc(hq) + ' / <i class="lg-bar"></i>세로 막대 : 전국평균</small></span></figcaption>' +
          dotplot(R, t, hq) + '</figure>' +
        '<figure><figcaption class="fig-cap"><span class="fig-no">2</span><span class="fig-txt"><strong>' + esc(me) + ' 시군별 고객호수와 전력사용량</strong><small>점선 = ' + esc(me) + ' 평균 고객 1호당 사용량 (월 ' + num(cn.avg, 0) + ' kWh) · 위는 평균보다 많이, 아래는 적게 써요</small></span></figcaption>' +
          scatter(R.cities.map(c => ({ name: c.city, x: c.custCnt, y: c.powerUsage, hl: false })),
            { yDiv: 1e6, yLabel: '전력사용량 (GWh, 로그 척도)', refPerCust: cn.avg, refLabel: me + ' 평균 호당 사용량', aria: me + ' 시군 고객호수 대비 전력사용량 산점도' }) +
          '<ul class="city-notes">' +
            // 1일차 실습2(전력을 많이 쓰는 동네는 어떤 동네인가?)의 해석을 그대로 적용
            (cn.above.length ? '<li><b>산업형 (점선 위)</b><span>' + cn.above.map(c => esc(c.city) + ' ' + num(perCust(c), 0)).join(' · ') + ' kWh/호.<br>산업용 비중이 ' + cn.indRange(cn.above) + '%인 곳이에요.<br>공장 계약 한 건이 가정 수백 곳만큼 쓰기 때문에 호당 사용량이 커져요.</span></li>' : '') +
            (cn.below.length ? '<li><b>생활·농촌형 (점선 아래)</b><span>' + cn.below.map(c => esc(c.city) + ' ' + num(perCust(c), 0)).join(' · ') + ' kWh/호.<br>주택·농사용처럼 한 건당 사용량이 작은 계약이 많은 곳이에요.</span></li>' : '') +
          '</ul></figure>' +
      '</div>' +
      '<p class="small muted">자료: ' + esc(R.source) + ' · 고객호수는 계약 호수 기준</p>' +
      (footer || '') +
      '</article>';
  }

  OB.regionTraits = { render, traits, lead, short };
})();
