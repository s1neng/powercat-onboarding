-- 파워캣 온보딩: 본부 공유 장소(맛집·관광지·지역특성) 테이블
-- Supabase 대시보드 → SQL Editor → New query 에 붙여넣고 Run.
--
-- 팀 프로젝트를 함께 쓰므로:
--  · 모든 이름에 powercat_ 를 붙여 팀 테이블과 구분
--  · 로그인 설정(익명 로그인 등)은 바꾸지 않음 → 팀 앱 보안 규칙에 영향 없음
--  · 로그인 없이 누구나 읽고 등록, 삭제는 등록한 브라우저만 (브라우저가 가진 비밀 토큰으로 확인)

create table if not exists public.powercat_places (
  id           uuid primary key default gen_random_uuid(),
  hq           text not null check (char_length(hq) between 1 and 20),        -- 본부 (예: 충북본부)
  type         text not null check (type in ('food', 'tour', 'trait')),     -- 맛집·관광지·지역특성
  name         text not null check (char_length(name) between 1 and 30),
  descr        text not null check (char_length(descr) between 1 and 60),   -- 한 줄 소개
  addr         text check (char_length(addr) <= 80),
  area         text check (char_length(area) <= 10),                         -- 시군 태그 (예: 청주)
  lat          double precision check (lat between 33 and 39),
  lng          double precision check (lng between 124 and 132),
  author       text check (char_length(author) <= 20),                       -- 대화명 (사번·실명 저장 안 함)
  owner_token  uuid not null,                                                -- 삭제용 비밀값 (읽기 불가)
  created_at   timestamptz not null default now()
);

create index if not exists powercat_places_hq_idx on public.powercat_places (hq, created_at desc);

-- 컬럼 권한: owner_token 은 누구도 읽을 수 없게
revoke all on public.powercat_places from anon, authenticated;
grant select (id, hq, type, name, descr, addr, area, lat, lng, author, created_at) on public.powercat_places to anon, authenticated;
grant insert (hq, type, name, descr, addr, area, lat, lng, author, owner_token) on public.powercat_places to anon, authenticated;

-- 행 보안: 누구나 읽기·등록, 직접 삭제·수정은 불가 (삭제는 아래 함수로만)
alter table public.powercat_places enable row level security;

drop policy if exists "powercat_places_read" on public.powercat_places;
create policy "powercat_places_read" on public.powercat_places
  for select to anon, authenticated using (true);

drop policy if exists "powercat_places_insert" on public.powercat_places;
create policy "powercat_places_insert" on public.powercat_places
  for insert to anon, authenticated with check (true);

-- 삭제: 등록할 때 쓴 토큰이 맞을 때만
create or replace function public.powercat_delete_place(p_id uuid, p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from public.powercat_places where id = p_id and owner_token = p_token;
  return found;
end $$;
revoke all on function public.powercat_delete_place(uuid, uuid) from public;
grant execute on function public.powercat_delete_place(uuid, uuid) to anon, authenticated;

-- 도배 방지: 본부별 하루 200건까지
create or replace function public.powercat_places_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.powercat_places where hq = new.hq and created_at > now() - interval '1 day') >= 200 then
    raise exception '오늘 등록 한도를 넘었어요. 내일 다시 시도해 주세요';
  end if;
  return new;
end $$;

drop trigger if exists powercat_places_rate_limit on public.powercat_places;
create trigger powercat_places_rate_limit before insert on public.powercat_places
  for each row execute function public.powercat_places_rate_limit();
