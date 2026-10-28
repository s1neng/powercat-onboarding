// REGION: 본부 사업소 지표(판매수입·고객호수·전력사용량), 맛집·관광지·지역특성 등록
(function () {
  const K = OB.core, D = OB.data, esc = K.esc;
  const METRICS = [
    { key: 'sales', label: '판매수입', unit: '억원' },
    { key: 'customers', label: '고객호수', unit: '호' },
    { key: 'usage', label: '전력사용량', unit: 'GWh' }
  ];

  const HOWTO = { traits: '① 카드를 보고 퀴즈 2문제를 맞혀요', stats: '② 지표 카드를 보고 퀴즈 2문제를 맞혀요', food: '「우리 지역 알려주기」에서 맛집을 등록해요', tour: '「우리 지역 알려주기」에서 관광지를 등록해요', trait: '「우리 지역 알려주기」에서 지역특성을 등록해요' };
  const num = v => v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  // 원·kWh → 화면 단위(억원·GWh)
  const toRow = (name, x) => ({ office: name, sales: Math.round(x.bill / 1e7) / 10, customers: x.custCnt, usage: Math.round(x.powerUsage / 1e5) / 10 });

  function ui() {
    const u = OB.app.ui;
    if (!u.region) u.region = { metric: 'sales', type: 'food' };
    return u.region;
  }

  // collector/collect.ps1 이 만든 실데이터가 내 본부 것이면 사용, 아니면 샘플
  function statsFor(hq) {
    const R = OB.regionData;
    if (R && R.hq === hq && R.cities && R.cities.length) {
      const [y, mo] = R.latest.split('-');
      return {
        real: true, unitLabel: '시군구', rows: R.cities.map(c => toRow(c.city, c)),
        badge: (R.mock ? '모의 데이터 · ' : '한전 개방데이터 · ') + y + '년 ' + (+mo) + '월',
        source: R.source + ' · ' + R.collectedAt + ' 수집',
        contracts: R.contracts.map(c => toRow(c.cntr, c)),
        trend: R.months.map(ym => R.cities.reduce((acc, c) => {
          const t = c.trend.find(x => x.ym === ym);
          if (t) { acc.bill += t.bill; acc.custCnt += t.custCnt; acc.powerUsage += t.powerUsage; }
          return acc;
        }, { ym, bill: 0, custCnt: 0, powerUsage: 0 })).map(t => toRow(t.ym, t))
      };
    }
    return { real: false, unitLabel: '사업소', rows: D.officeStats(hq), badge: '샘플 · 월 기준' };
  }

  function extras(st, m) {
    if (!st.real) return '';
    const tmax = Math.max(...st.trend.map(t => t[m.key])) || 1;
    const ctot = st.contracts.reduce((a, c) => a + c[m.key], 0) || 1;
    return '<h3 class="list-title">최근 ' + st.trend.length + '개월 ' + m.label + ' 추이 (합계)</h3>' +
      '<div class="trend">' + st.trend.map(t => '<div class="tr-col" title="' + esc(t.office) + ' · ' + num(t[m.key]) + ' ' + m.unit + '"><i style="height:' + (t[m.key] / tmax * 100).toFixed(1) + '%"></i><span>' + (+t.office.slice(5)) + '월</span></div>').join('') + '</div>' +
      '<h3 class="list-title">계약종별 ' + m.label + ' (최신 월)</h3>' +
      '<ul class="hbars">' + st.contracts.slice().sort((a, b) => b[m.key] - a[m.key]).map(c =>
        '<li><span class="hb-label">' + esc(c.office) + '</span><span class="hb-track"><i style="width:' + (c[m.key] / ctot * 100).toFixed(1) + '%"></i></span><b>' + Math.round(c[m.key] / ctot * 100) + '<small>%</small></b></li>').join('') + '</ul>' +
      '<p class="small muted">출처: ' + esc(st.source) + '. 판매수입은 전기요금 합계, 고객호수는 계약 호수입니다.</p>';
  }

  // 내가 등록한 장소는 지도 위치가 없으면 고른 시군 중심에 핀
  const placesOf = state => D.placesFor(state.user.hq).concat(state.region.places.map(x =>
    Object.assign({ mine: true, author: state.user.nickname }, x, { ll: x.ll || (x.area && areasOf(state.user.hq)[x.area]) || null })));

  // ---------- 지도 (Leaflet + OpenStreetMap, 인터넷 필요) ----------
  const KOREA = [36.4, 127.8];
  function areasOf(hq) { return D.AREAS_BY_HQ[hq] || {}; }
  function boundsOf(hq, pts, pad) {
    const ll = Object.values(areasOf(hq)).concat(pts.map(p => p.ll));
    return ll.length > 1 ? L.latLngBounds(ll).pad(pad == null ? 0.08 : pad) : null;
  }
  function pinIcon(type, mine) {
    return L.divIcon({ className: 'pin-wrap', iconSize: [34, 42], iconAnchor: [17, 40], popupAnchor: [0, -36],
      html: '<span class="pin pin-' + type + (mine ? ' mine' : '') + '"><i>' + D.PLACE_TYPES[type].icon + '</i></span>' });
  }
  // 바탕: OpenStreetMap 지도 그림 + 행정구역 경계선(js/region-geo.js).
  // 웹 링크처럼 외부 지도 그림이 막힌 곳에서는 경계선을 색칠해 지도 역할을 하게 함.
  function baseMap(el, hq, opts) {
    const map = L.map(el, Object.assign({ scrollWheelZoom: true, attributionControl: true }, opts));
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
    const G = OB.regionGeo, layers = [];
    if (G) {
      const mine = G.hq && G.hq[hq];
      layers.push(L.geoJSON(G.provinces, { interactive: false, style: { color: '#98a2b3', weight: 1, fillColor: '#f4f1ea', fillOpacity: 0 } }).addTo(map));
      if (mine) layers.push(L.geoJSON(mine, { interactive: false, style: { color: '#ee7a30', weight: 1.2, opacity: .55, fillColor: '#fff3e6', fillOpacity: 0 } }).addTo(map));
      map.attributionControl.addAttribution('경계: 통계청 SGIS');
      let off = false;
      tiles.on('tileerror', () => {
        if (off) return;
        off = true;
        el.classList.add('no-tiles');
        layers[0].setStyle({ fillOpacity: 1 });
        if (layers[1]) layers[1].setStyle({ fillOpacity: 1, fillColor: '#ffe6cf', opacity: 1, color: '#e9a06b' });
      });
    }
    return map;
  }
  function placeMap(root, state, type) {
    const el = root.querySelector('#placeMap');
    if (!el) return null;
    if (!window.L) { el.innerHTML = '<p class="map-off">지도를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</p>'; return null; }
    const pts = placesOf(state).filter(p => p.type === type && p.ll);
    const map = baseMap(el, state.user.hq), markers = {};
    // 시군 이름 표시
    Object.entries(areasOf(state.user.hq)).forEach(([n, ll]) => L.marker(ll, { interactive: false, icon: L.divIcon({ className: 'area-lbl', html: n, iconSize: [40, 16] }) }).addTo(map));
    pts.forEach(p => {
      markers[p.id] = L.marker(p.ll, { icon: pinIcon(p.type, p.mine), title: p.name }).addTo(map)
        .bindPopup('<b>' + esc(p.name) + '</b><br><span class="tag">' + esc(p.area || '') + '</span> ' + esc(p.desc) + (p.addr ? '<br><small>📍 ' + esc(p.addr) + '</small>' : '') + (p.check ? '<br><small>⚠ 위치 대략 · 영업 확인 필요</small>' : '') + '<br><small>' + esc(p.author) + '</small>');
    });
    const b = boundsOf(state.user.hq, pts);
    if (b) map.fitBounds(b); else map.setView(KOREA, 7);
    return { map, markers };
  }

  // ---------- 주소 → 좌표 (OpenStreetMap Nominatim, 키 불필요·초당 1회 제한) ----------
  const ABBR = { '충북': '충청북도', '충남': '충청남도', '경북': '경상북도', '경남': '경상남도', '전북': '전북특별자치도', '전남': '전라남도', '강원': '강원특별자치도' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let lastGeo = 0;
  async function geocode(addr) {
    const words = addr.replace(/\(.*?\)/g, ' ').replace(/[,·]/g, ' ').trim().split(/\s+/).map(w => ABBR[w] || w);
    // 못 찾으면 끝에서부터 한 단어씩 줄여 다시 찾기 (건물번호 → 도로·동 → 시군)
    for (let n = words.length; n >= 2; n--) {
      const wait = 1100 - (Date.now() - lastGeo);
      if (wait > 0) await sleep(wait);
      lastGeo = Date.now();
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kr&accept-language=ko&q=' + encodeURIComponent(words.slice(0, n).join(' ')));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (j[0]) return { ll: [+(+j[0].lat).toFixed(5), +(+j[0].lon).toFixed(5)], exact: n === words.length, used: words.slice(0, n).join(' ') };
    }
    return null;
  }

  // ---------- 이름으로 장소 찾기 ----------
  // 1순위: 카카오 로컬 키워드 검색 (실행.bat 로컬 서버가 중계, 키는 PC에만 저장)
  // 2순위: OpenStreetMap 이름 검색 (키 없음·결과가 적음)
  async function searchKakao(q) {
    if (!/^https?:$/.test(location.protocol)) return { error: 'noserver' };
    let r;
    try { r = await fetch('api/place-search?q=' + encodeURIComponent(q)); } catch (e) { return { error: 'noserver' }; }
    // 중계 없는 서버(예: 웹에 올린 버전)는 404나 HTML을 돌려주므로 JSON이 아니면 대체 검색으로
    if (r.status === 404 || !/json/.test(r.headers.get('content-type') || '')) return { error: 'noserver' };
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { error: j.error || 'upstream' };
    return { src: 'kakao', items: (j.documents || []).map(x => ({
      name: x.place_name, cat: String(x.category_name || '').split('>').pop().trim(),
      addr: x.road_address_name || x.address_name, area: x.address_name,
      ll: x.y && x.x ? [+(+x.y).toFixed(5), +(+x.x).toFixed(5)] : null // x: 경도, y: 위도 (WGS84)
    })) };
  }
  async function searchOsm(q, hq) {
    const pts = Object.values(areasOf(hq));
    const vb = pts.length ? '&bounded=1&viewbox=' + [Math.min(...pts.map(p => p[1])) - 0.1, Math.max(...pts.map(p => p[0])) + 0.1, Math.max(...pts.map(p => p[1])) + 0.1, Math.min(...pts.map(p => p[0])) - 0.1].join(',') : '';
    const wait = 1100 - (Date.now() - lastGeo);
    if (wait > 0) await sleep(wait);
    lastGeo = Date.now();
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=kr&accept-language=ko' + vb + '&q=' + encodeURIComponent(q));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return { src: 'osm', items: (await r.json()).map(x => { const name = x.name || x.display_name.split(',')[0]; return {
      name, cat: x.type === 'restaurant' ? '음식점' : x.type === 'cafe' ? '카페' : '',
      addr: x.display_name.split(',').map(s => s.trim()).filter(s => s !== '대한민국' && s !== name && !/^\d{5}$/.test(s)).reverse().join(' '),
      ll: [+(+x.lat).toFixed(5), +(+x.lon).toFixed(5)]
    }; }) };
  }
  // 지역 제한 없이 전국에서 찾음
  async function searchPlaces(q) {
    const kk = await searchKakao(q);
    if (!kk.error) return kk;
    const os = await searchOsm(q, '');
    os.why = kk.error;
    return os;
  }

  // ---------- 등록 팝업 ----------
  function addModal(type) {
    const u = OB.app.state.user, areas = areasOf(u.hq), names = Object.keys(areas);
    const ph = { food: '예) 지사 앞 칼국수집', tour: '예) 호숫가 둘레길', trait: '예) 겨울철 난방 수요 급증' };
    OB.app.modal('우리 지역 알려주기',
      '<form id="placeForm" class="stack">' +
        '<div class="tabs" id="pfType">' + Object.keys(D.PLACE_TYPES).map(k => '<button type="button" class="' + (k === type ? 'on' : '') + '" data-pt="' + k + '">' + D.PLACE_TYPES[k].icon + ' ' + D.PLACE_TYPES[k].label + '</button>').join('') + '</div>' +
        '<div class="pf-search pf-loc"><span class="pf-addr"><input id="pfQ" type="search" maxlength="40" placeholder="🔍 이름으로 찾기 (예: 함지락, 청남대)" autocomplete="off"><button type="button" class="btn primary sm" id="pfSearch">검색</button></span>' +
          '<div id="pfResults" class="pf-results" aria-live="polite"></div></div>' +
        '<label><span id="pfNameL">' + D.PLACE_TYPES[type].label + '</span> 이름<input name="name" maxlength="30" required placeholder="' + ph[type] + '"></label>' +
        '<label>한 줄 소개<input name="desc" maxlength="60" required placeholder="동기·후배에게 알려주고 싶은 점"></label>' +
        '<label class="pf-loc">주소<span class="pf-addr"><input name="addr" maxlength="80" placeholder="예) 충북 청주시 상당구 상당로 69"><button type="button" class="btn ghost sm" id="pfFind">📍 찾기</button></span></label>' +
        '<p class="small muted pf-status pf-loc" id="pfStatus" aria-live="polite">주소를 넣으면 지도에 자동으로 핀이 꽂혀요.</p>' +
        '<div class="pf-map-wrap pf-loc"><span class="small muted">위치가 다르면 지도를 눌러 옮길 수 있어요</span><div id="pfMap" class="pf-map"></div></div>' +
        '<button class="btn primary">등록</button></form>', dlg => {
      const f = dlg.querySelector('#placeForm');
      let t = type, ll = null, map = null, mk = null, pinBy = null;
      (t === 'trait' ? f.elements.name : dlg.querySelector('#pfQ')).focus();
      const setPin = p => {
        ll = [+p[0].toFixed(5), +p[1].toFixed(5)];
        if (!map) return;
        if (mk) mk.setLatLng(ll).setIcon(pinIcon(t, true)); else mk = L.marker(ll, { icon: pinIcon(t, true) }).addTo(map);
      };
      if (window.L) {
        map = baseMap(dlg.querySelector('#pfMap'), u.hq);
        const b = boundsOf(u.hq, [], 0);
        if (b) map.fitBounds(b); else map.setView(KOREA, 7);
        map.on('click', e => { setPin([e.latlng.lat, e.latlng.lng]); pinBy = 'exact'; });
        setTimeout(() => { map.invalidateSize(); if (b) map.fitBounds(b); }, 60);
      } else dlg.querySelector('#pfMap').innerHTML = '<p class="map-off">지도를 불러오지 못했어요 (인터넷 필요). 주소만 입력해도 등록돼요.</p>';
      // 주소 입력 → 자동 핀 (입력이 멈추고 1초 뒤, 또는 찾기 버튼)
      const status = dlg.querySelector('#pfStatus');
      let seq = 0, timer = 0, found = '';
      const find = async () => {
        const a = f.elements.addr.value.trim();
        if (a.length < 4 || a === found) return;
        const my = ++seq;
        status.textContent = '주소를 찾는 중…'; status.className = 'small muted pf-status';
        try {
          const g = await geocode(a);
          if (my !== seq) return;
          found = a;
          if (!g) { status.textContent = '주소를 찾지 못했어요. 시군을 고르거나 지도를 직접 눌러 주세요.'; status.className = 'small pf-status warn'; return; }
          setPin(g.ll); pinBy = 'exact';
          if (map) map.setView(g.ll, g.exact ? 16 : 14);
          status.textContent = g.exact ? '✓ 주소 위치에 핀을 꽂았어요.' : '✓ 「' + g.used + '」 근처로 찾았어요. 정확한 위치는 지도를 눌러 옮겨 주세요.';
          status.className = 'small pf-status ok';
        } catch (err) {
          if (my !== seq) return;
          status.textContent = '주소 검색을 할 수 없어요(인터넷 필요). 시군을 고르거나 지도를 눌러 주세요.'; status.className = 'small pf-status warn';
        }
      };
      // 이름 검색 → 결과 목록 → 하나 고르면 이름·주소·시군·핀 자동 입력
      const qIn = dlg.querySelector('#pfQ'), box = dlg.querySelector('#pfResults');
      let qSeq = 0, qTimer = 0, results = [];
      const SRC = { kakao: '카카오 로컬', osm: 'OpenStreetMap' };
      const WHY = { nokey: '카카오 키가 없어서', noserver: '카카오 검색 중계가 없는 환경(웹 링크·파일 직접 열기)이라', badkey: '카카오 키가 맞지 않아서', disabled: '카카오 앱의 카카오맵 사용 설정이 꺼져 있어서', limit: '카카오 검색 한도를 넘어서', upstream: '카카오 검색이 응답하지 않아서' };
      const search = async () => {
        const q = qIn.value.trim();
        if (q.length < 2) { box.innerHTML = ''; return; }
        const my = ++qSeq;
        box.innerHTML = '<p class="small muted">찾는 중…</p>';
        try {
          const r = await searchPlaces(q);
          if (my !== qSeq) return;
          results = r.items;
          box.innerHTML = (results.length ? '<ul class="pf-list">' + results.map((x, i) => '<li><button type="button" data-pick="' + i + '"><b>' + esc(x.name) + '</b>' + (x.cat ? ' <span class="tag">' + esc(x.cat) + '</span>' : '') + '<small>' + esc(x.addr || '') + '</small></button></li>').join('') + '</ul>'
              : '<p class="small muted">검색 결과가 없어요. 다른 이름으로 찾거나 아래에 직접 입력해 주세요.</p>') +
            '<p class="pf-src small muted">검색: ' + SRC[r.src] + (r.why ? ' · ' + WHY[r.why] + ' 대신 사용 중' + (r.why === 'nokey' ? ' (카카오키설정.bat)' : '') : '') + '</p>';
        } catch (err) {
          if (my !== qSeq) return;
          box.innerHTML = '<p class="small pf-status warn">검색할 수 없어요(인터넷 필요). 아래에 직접 입력해 주세요.</p>';
        }
      };
      qIn.addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(search, 700); });
      qIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(qTimer); search(); } });
      dlg.querySelector('#pfSearch').addEventListener('click', () => { clearTimeout(qTimer); search(); });
      box.addEventListener('click', async e => {
        const b = e.target.closest('[data-pick]');
        if (!b) return;
        const x = results[+b.dataset.pick];
        box.querySelectorAll('[data-pick]').forEach(y => y.classList.toggle('on', y === b));
        f.elements.name.value = x.name;
        f.elements.addr.value = x.addr || '';
        if (x.ll) {
          setPin(x.ll); pinBy = 'exact'; found = f.elements.addr.value.trim();
          if (map) map.setView(x.ll, 16);
          status.textContent = '✓ ' + x.name + ' 위치에 핀을 꽂았어요. 한 줄 소개만 써 주세요.'; status.className = 'small pf-status ok';
        } else { found = ''; find(); }
        f.elements.desc.focus();
      });
      f.elements.addr.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(find, 1000); });
      f.elements.addr.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); find(); } });
      dlg.querySelector('#pfFind').addEventListener('click', () => { clearTimeout(timer); found = ''; find(); });
      dlg.querySelector('#pfType').addEventListener('click', e => {
        const b = e.target.closest('[data-pt]');
        if (!b) return;
        t = b.dataset.pt;
        dlg.querySelectorAll('[data-pt]').forEach(x => x.classList.toggle('on', x === b));
        dlg.querySelector('#pfNameL').textContent = D.PLACE_TYPES[t].label;
        f.elements.name.placeholder = ph[t];
        if (mk) mk.setIcon(pinIcon(t, true));
        showLoc();
      });
      // 지역특성은 장소가 아니므로 주소·지도 숨김
      function showLoc() {
        dlg.querySelectorAll('.pf-loc').forEach(x => { x.hidden = t === 'trait'; });
        if (map && t !== 'trait') setTimeout(() => map.invalidateSize(), 0);
      }
      showLoc();
      f.addEventListener('submit', e => {
        e.preventDefault();
        const name = f.elements.name.value.trim(), desc = f.elements.desc.value.trim();
        if (!name || !desc) return;
        // 시군 태그는 주소에서 자동으로 (본부 지역 밖이면 비움)
        const area = names.find(n => f.elements.addr.value.includes(n)) || '';
        const p = { id: K.uid(), type: t, name, desc, at: K.todayISO() };
        const addr = f.elements.addr.value.trim();
        if (area) p.area = area;
        if (addr && t !== 'trait') p.addr = addr;
        if (ll && t !== 'trait') p.ll = ll;
        ui().type = t;
        OB.app.closeModal();
        OB.app.update(st => st.region.places.push(p));
        OB.app.toast(D.PLACE_TYPES[t].label + '을(를) 등록했어요. 본부 동료들에게 공유됩니다');
      });
    });
  }

  function render(state) {
    const s = ui(), p = K.progress(state), u = state.user, items = K.regionItems(state);
    const st = statsFor(u.hq), rows = st.rows;
    const m = METRICS.find(x => x.key === s.metric);
    const max = Math.max(...rows.map(r => r[m.key])) || 1;
    const sum = k => rows.reduce((a, r) => a + r[k], 0);
    const all = placesOf(state), shown = all.filter(x => x.type === s.type);
    const cnt = t => all.filter(x => x.type === t).length, mine = state.region.places.length;
    const me = OB.regionData && st.real ? OB.regionData.metro.replace(/^충청북도$/, '충북') : u.hq;
    const folds = [
      { id: 'traits', icon: '🗺️', title: (st.real ? me + '은' : '우리 지역은') + ' 어떤 지역일까?', sub: st.real ? '전국 ' + OB.regionData.metros.length + '개 시도와 비교' : '전국 비교 데이터 준비 중', done: !!state.region.traitsChecked },
      { id: 'stats', icon: '📊', title: '본부 ' + st.unitLabel + '별 전력사용량', sub: rows.length + '곳 · 판매수입·고객호수·전력사용량', done: !!state.region.statsChecked },
      { id: 'places', icon: '📍', title: '우리 지역 알려주기', sub: '맛집 ' + cnt('food') + ' · 관광지 ' + cnt('tour') + ' · 지역특성 ' + cnt('trait'), done: ['food', 'tour', 'trait'].every(k => items.find(i => i.id === k).done) }
    ];

    return OB.app.header('지역 · ' + u.hq, p.region, 'region') +
      '<section class="grid top-row">' +
        '<article class="card span6 checklist-card">' +
          '<div class="card-head"><h2>지역 이수 체크리스트</h2><span class="badge">' + items.filter(i => i.done).length + ' / ' + items.length + ' 완료</span></div>' +
          '<ul class="checklist">' + items.map(i => '<li class="' + (i.done ? 'done' : '') + '">' +
            '<button type="button" data-jump="' + i.id + '"><span class="ck" aria-hidden="true">' + (i.done ? '✓' : '') + '</span>' +
            '<span class="grow"><b>' + esc(i.label) + '</b><small>' + (i.done ? '완료했어요' : HOWTO[i.id]) + '</small></span><span class="go" aria-hidden="true">›</span></button></li>').join('') + '</ul>' +
        '</article>' +
        '<article class="card span6 summary-card">' +
          '<div class="card-head"><h2>파워캣 요약</h2></div>' +
          '<div class="summary-body"><img src="assets/powercat-point.png" alt=""><p>' +
            (st.real && OB.regionTraits.lead(OB.regionData) || esc(u.hq) + '의 지표와 동료들이 알려준 맛집·관광지를 둘러보며 우리 지역과 친해져 보세요!') + '</p></div>' +
        '</article>' +
      '</section>' +
      // 펼침 카드 3개: 누르면 아래에 내용이 펼쳐짐 (한 번에 하나)
      '<section class="fold-cards" role="tablist">' + folds.map((x, i) =>
        '<button type="button" class="fold-card' + (s.open === x.id ? ' on' : '') + '" data-fold="' + x.id + '" aria-expanded="' + (s.open === x.id) + '" aria-controls="fold-panel">' +
          '<span class="fc-no">' + (i + 1) + '</span><span class="fc-icon" aria-hidden="true">' + x.icon + '</span>' +
          '<span class="fc-text"><b>' + esc(x.title) + '</b><small>' + x.sub + '</small></span>' +
          (x.done ? '<span class="fc-done">✓</span>' : '') + '<span class="fc-chev" aria-hidden="true">⌄</span></button>').join('') + '</section>' +
      (s.open ? '<section class="grid fold-panel" id="fold-panel">' + panel(s.open) + '</section>' : '');

    function panel(id) {
      if (id === 'traits') return st.real ? OB.regionTraits.render(OB.regionData, state.region.traitsChecked ? '<p class="ok">✅ 지역 특징 확인 완료</p>' : '<button class="btn primary quiz-btn" data-quiz="traits">🧩 퀴즈 풀고 확인하기 (2문제)</button>') : '<article class="card span12"><p class="muted">' + esc(u.hq) + '은(는) 아직 전국 비교 데이터가 없어요. 데이터수집.bat으로 본부 데이터를 모으면 여기에 표시돼요.</p></article>';
      if (id === 'stats') return statsCard();
      return placesCard();
    }
    function statsCard() { return '' +
        '<article class="card span12 stats-card">' +
          '<div class="card-head wrap"><h2>본부 ' + st.unitLabel + '별 전력사용량 <span class="badge ' + (st.real ? 'live' : '') + '">' + esc(st.badge) + '</span></h2>' +
            '<div class="tabs">' + METRICS.map(x => '<button class="' + (x.key === s.metric ? 'on' : '') + '" data-metric="' + x.key + '">' + x.label + '</button>').join('') + '</div></div>' +
          '<div class="kpis">' + METRICS.map(x => '<div class="kpi"><span>' + x.label + ' 합계</span><b>' + num(sum(x.key)) + '</b><em>' + x.unit + '</em></div>').join('') + '</div>' +
          '<ul class="hbars">' + rows.slice().sort((a, b) => b[m.key] - a[m.key]).map(r =>
            '<li><span class="hb-label">' + esc(r.office) + '</span><span class="hb-track"><i style="width:' + (r[m.key] / max * 100).toFixed(1) + '%"></i></span><b>' + num(r[m.key]) + '<small> ' + m.unit + '</small></b></li>').join('') + '</ul>' +
          extras(st, m) +
          '<div class="table-wrap"><table class="tbl small-tbl"><thead><tr><th>' + st.unitLabel + '</th>' + METRICS.map(x => '<th class="num">' + x.label + ' (' + x.unit + ')</th>').join('') + '</tr></thead><tbody>' +
            rows.map(r => '<tr><td>' + esc(r.office) + '</td>' + METRICS.map(x => '<td class="num">' + num(r[x.key]) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
          (state.region.statsChecked ? '<p class="ok">✅ 지표 확인 완료</p>' : '<button class="btn primary quiz-btn" data-quiz="stats">🧩 퀴즈 풀고 확인하기 (2문제)</button>') +
        '</article>';
    }
    function placesCard() { return '' +
        '<article class="card span12">' +
          '<div class="card-head"><h2>우리 지역 알려주기</h2><button class="btn primary sm" data-act="add-place">＋ 등록</button></div>' +
          '<div class="tabs">' + Object.keys(D.PLACE_TYPES).map(k => '<button class="' + (s.type === k ? 'on' : '') + '" data-type="' + k + '">' + D.PLACE_TYPES[k].icon + ' ' + D.PLACE_TYPES[k].label + (items.find(i => i.id === k).done ? ' ✓' : '') + '</button>').join('') + '</div>' +
          // 지역특성은 장소가 아니라서 지도 없이 목록만
          (s.type === 'trait' ? '<div class="places-body no-map"><div class="places-list">' :
          '<div class="places-body"><div class="places-map">' +
          '<div id="placeMap" class="place-map" role="region" aria-label="' + esc(u.hq) + ' ' + D.PLACE_TYPES[s.type].label + ' 지도"></div>' +
          '<p class="small muted map-note">핀을 누르면 소개가 보여요. 추천 장소 위치는 카카오맵 기준(2026.10)이에요.' + (shown.some(p => p.area) ? ' 추천 맛집은 언론 보도·백년가게 지정 기준이니 영업 여부는 방문 전에 확인하세요.' : '') + '</p></div><div class="places-list">') +
          '<h3 class="list-title">' + esc(u.hq) + ' ' + D.PLACE_TYPES[s.type].label + ' 목록 <small class="muted">' + shown.length + (s.type === 'trait' ? '가지' : '곳') + '</small></h3>' +
          (shown.length ? '<ul class="places">' + shown.map(x => '<li class="' + (x.mine ? 'mine' : '') + (x.ll && s.type !== 'trait' ? ' pinable" data-pin="' + x.id + '" title="누르면 지도에서 위치를 보여줘요' : '') + '"><span class="pl-icon">' + D.PLACE_TYPES[x.type].icon + '</span>' +
            '<div class="grow"><b>' + esc(x.name) + '</b> <span class="tag">' + (x.area ? esc(x.area) + ' · ' : '') + D.PLACE_TYPES[x.type].label + '</span><div class="small">' + esc(x.desc) + '</div>' + (x.addr ? '<div class="small muted">📍 ' + esc(x.addr) + '</div>' : '') + (x.check ? '<div class="small pl-check">⚠ 카카오맵에서 찾지 못했어요. 위치는 대략이고 영업 여부를 확인해 주세요.</div>' : '') + '<div class="small muted">' + (x.area && !x.mine ? '출처: ' : '') + esc(x.author) + '</div></div>' +
            (x.ll && s.type !== 'trait' ? '<button class="btn ghost icon" data-focus="' + x.id + '" aria-label="지도에서 보기" title="지도에서 보기">📍</button>' : '') +
            (x.mine ? '<button class="btn ghost icon" data-del="' + x.id + '" aria-label="삭제">✕</button>' : '') + '</li>').join('') + '</ul>'
            : '<p class="small muted">아직 등록된 ' + D.PLACE_TYPES[s.type].label + '이(가) 없어요. ＋ 등록으로 첫 번째를 알려주세요!</p>') +
          '</div></div>' +
        '</article>';
    }
  }

  // 펼친 카드가 화면에 들어오도록 (렌더 후 새 DOM 기준)
  function reveal() {
    const el = document.querySelector('.fold-cards');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function mount(root) {
    const s = ui();
    let pm = null;
    const focusPin = id => {
      const m = pm && pm.markers[id];
      if (!m) return;
      const el = root.querySelector('#placeMap'), r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); // 지도가 화면 밖일 때만 스크롤
      pm.map.setView(m.getLatLng(), 15); m.openPopup();
      root.querySelectorAll('.places li.on').forEach(x => x.classList.remove('on'));
      const li = root.querySelector('[data-pin="' + id + '"]'); if (li) li.classList.add('on');
    };
    root.addEventListener('click', e => {
      let b;
      // 체크리스트 항목 → 해당 작업 위치로 이동
      if ((b = e.target.closest('[data-jump]'))) {
        const id = b.dataset.jump;
        if (id === 'stats' || id === 'traits') { s.open = id; OB.app.render(); reveal(); }
        else { s.type = id; s.open = 'places'; OB.app.render(); addModal(id); }
      }
      else if ((b = e.target.closest('[data-fold]'))) {
        s.open = s.open === b.dataset.fold ? null : b.dataset.fold;
        OB.app.render();
        if (s.open) reveal();
      }
      else if ((b = e.target.closest('[data-act="add-place"]'))) addModal(s.type);
      else if ((b = e.target.closest('[data-focus]'))) focusPin(b.dataset.focus);
      else if ((b = e.target.closest('[data-metric]'))) { s.metric = b.dataset.metric; OB.app.render(); }
      else if ((b = e.target.closest('[data-type]'))) { s.type = b.dataset.type; OB.app.render(); }
      else if ((b = e.target.closest('[data-del]'))) OB.app.update(st => { st.region.places = st.region.places.filter(x => x.id !== b.dataset.del); });
      // 목록 항목을 누르면 지도에서 그 핀으로 이동
      else if ((b = e.target.closest('[data-pin]'))) focusPin(b.dataset.pin);
      else if ((b = e.target.closest('[data-quiz]'))) {
        // 퀴즈를 모두 맞히면 이수 (팝업은 #app 밖이라 뒤 화면을 다시 그려도 결과가 그대로 보임)
        const kind = b.dataset.quiz, st = statsFor(OB.app.state.user.hq);
        OB.regionQuiz.open(kind, { R: OB.regionData, rows: st.rows, unit: st.unitLabel, hq: OB.app.state.user.hq }, () => {
          OB.app.update(x => { x.region[kind === 'traits' ? 'traitsChecked' : 'statsChecked'] = true; });
          OB.app.toast(kind === 'traits' ? '지역 특징 확인 완료!' : '지표 확인 완료!');
        });
      }
    });
    if (s.open === 'places') pm = placeMap(root, OB.app.state, s.type);
  }

  OB.views.region = { render, mount };
})();
