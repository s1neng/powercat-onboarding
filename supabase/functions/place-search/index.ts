// 파워캣 온보딩: 카카오 로컬 키워드 검색 중계 (Supabase Edge Function "place-search")
// 카카오 REST API 키는 Supabase 비밀값 KAKAO_REST_KEY 에만 둔다 (페이지·저장소에 넣지 않음).
// 로컬 serve.ps1 의 /api/place-search 와 같은 응답(카카오 JSON 그대로 / {error})을 돌려준다.

// 이 사이트들에서 온 요청만 받는다 (다른 사이트가 키를 대신 쓰지 못하게)
const ALLOWED = ['https://s1neng.github.io', 'http://localhost:8770'];

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const h = cors(origin);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json; charset=utf-8' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (!origin || !ALLOWED.includes(origin)) return json({ error: 'origin' }, 403);

  const key = Deno.env.get('KAKAO_REST_KEY');
  if (!key) return json({ error: 'nokey' }, 503);

  let q = '';
  try { q = String((await req.json()).q || '').trim().slice(0, 60); } catch { /* 빈 요청 */ }
  if (!q) return json({ error: 'noquery' }, 400);

  const r = await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?size=15&query=' + encodeURIComponent(q), {
    headers: { Authorization: 'KakaoAK ' + key },
  });
  if (!r.ok) {
    // 401: 키 오류 / 403: 카카오맵 사용 설정 꺼짐 / 429: 한도 초과
    const error = r.status === 401 ? 'badkey' : r.status === 403 ? 'disabled' : r.status === 429 ? 'limit' : 'upstream';
    return json({ error }, r.status);
  }
  return new Response(await r.text(), { headers: { ...h, 'Content-Type': 'application/json; charset=utf-8' } });
});
