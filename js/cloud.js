// Supabase 연동: 본부 공유 장소(맛집·관광지·지역특성) + 카카오 검색 중계(Edge Function).
// config 에 URL·anon 키가 없거나 라이브러리를 못 불러오면 조용히 꺼지고, 앱은 브라우저 저장소만 쓴다.
// 팀 프로젝트의 로그인 설정을 건드리지 않도록 로그인은 쓰지 않는다.
// 삭제는 등록한 브라우저만: 브라우저마다 비밀 토큰을 만들어 등록할 때 함께 저장하고, 지울 때 대조한다.
(function () {
  const C = OB.config, TABLE = 'powercat_places', TOKEN_KEY = C.STORAGE_KEY + '-cloud';
  const cloud = { on: false, places: [], error: '' };
  let sb = null, loadedHq = null, me = { token: null, ids: [] };

  // 이 브라우저의 토큰과 내가 올린 장소 id 목록 (브라우저 저장소)
  function loadMe() {
    try { me = Object.assign(me, JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}')); } catch (e) { /* 저장소 막힘 */ }
    if (!me.token) me.token = crypto.randomUUID();
    saveMe();
  }
  function saveMe() { try { localStorage.setItem(TOKEN_KEY, JSON.stringify(me)); } catch (e) { /* 저장소 막힘 */ } }

  cloud.init = async function () {
    if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY || !window.supabase) return false;
    try {
      sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      loadMe();
      // 테이블이 준비됐는지 한 번 확인 (없으면 꺼짐)
      const { error } = await sb.from(TABLE).select('id').limit(1);
      if (error) throw error;
      cloud.on = true;
    } catch (e) {
      cloud.error = e.message || String(e);
      console.warn('[cloud] 연결 안 됨, 브라우저 저장소만 사용:', cloud.error);
    }
    return cloud.on;
  };

  let readyP = null;
  cloud.ready = () => readyP || (readyP = cloud.init());
  cloud.loadedFor = hq => loadedHq === hq;

  const COLS = 'id,hq,type,name,descr,addr,area,lat,lng,author,created_at';
  // DB 행 → 앱 장소 형식
  const fromRow = r => ({ id: r.id, type: r.type, name: r.name, desc: r.descr, addr: r.addr || undefined, area: r.area || undefined,
    ll: r.lat != null && r.lng != null ? [r.lat, r.lng] : null, author: r.author || '동료', at: r.created_at.slice(0, 10),
    cloud: true, mine: me.ids.includes(r.id) });

  cloud.loadPlaces = async function (hq, force) {
    if (!cloud.on || (!force && loadedHq === hq)) return cloud.places;
    const { data, error } = await sb.from(TABLE).select(COLS).eq('hq', hq).order('created_at', { ascending: false }).limit(300);
    if (error) { cloud.error = error.message; return cloud.places; }
    loadedHq = hq;
    cloud.places = data.map(fromRow);
    return cloud.places;
  };

  cloud.addPlace = async function (hq, p, author) {
    if (!cloud.on) return null;
    const row = { hq, type: p.type, name: p.name, descr: p.desc, addr: p.addr || null, area: p.area || null,
      lat: p.ll ? p.ll[0] : null, lng: p.ll ? p.ll[1] : null, author: (author || '').slice(0, 20), owner_token: me.token };
    const { data, error } = await sb.from(TABLE).insert(row).select(COLS).single();
    if (error) throw new Error(error.message);
    me.ids.push(data.id); saveMe();
    const x = fromRow(data);
    cloud.places.unshift(x);
    return x;
  };

  cloud.deletePlace = async function (id) {
    if (!cloud.on) return;
    const { data, error } = await sb.rpc('powercat_delete_place', { p_id: id, p_token: me.token });
    if (error) throw new Error(error.message);
    if (!data) throw new Error('내가 등록한 항목만 지울 수 있어요');
    me.ids = me.ids.filter(x => x !== id); saveMe();
    cloud.places = cloud.places.filter(x => x.id !== id);
  };

  // 카카오 검색: 응답은 로컬 serve.ps1 중계와 같은 형식(카카오 JSON / {error})
  cloud.searchKakao = async function (q) {
    if (!cloud.on) return { error: 'noserver' };
    const { data, error } = await sb.functions.invoke('place-search', { body: { q } });
    if (error) {
      let code = 'upstream';
      try { code = (await error.context.json()).error || code; } catch (e) { /* 함수 없음·본문 없음 */ }
      return { error: code };
    }
    return data;
  };

  OB.cloud = cloud;
})();
