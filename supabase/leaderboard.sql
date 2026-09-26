-- Run once in the Supabase SQL Editor. Students have no accounts, so the public
-- role can read rankings and submit only mathematically correct attempts.
create table if not exists public.division_attempts (
  attempt_id text primary key check (attempt_id ~ '^[a-zA-Z0-9-]{8,80}$'),
  class_name text not null check (class_name in ('4A', '4B', '4C')),
  student_no integer not null check (student_no between 1 and 25),
  dividend integer not null check (dividend between 100 and 999),
  divisor integer not null check (divisor between 10 and 99),
  quotient integer not null,
  remainder integer not null,
  completed_at timestamptz not null default now(),
  constraint correct_division check (
    quotient = dividend / divisor and remainder = dividend % divisor
  )
);

create index if not exists division_attempts_student_idx
  on public.division_attempts (class_name, student_no);

alter table public.division_attempts enable row level security;

create policy "Read division scores" on public.division_attempts
  for select to anon, authenticated using (true);
create policy "Submit valid division answer" on public.division_attempts
  for insert to anon, authenticated with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert on public.division_attempts to anon, authenticated;

-- Runs with the caller's permissions: RLS continues to apply to every row.
create or replace function public.division_leaderboard()
returns table (class_name text, student_no integer, completed bigint)
language sql stable security invoker
set search_path = ''
as $$
  select a.class_name, a.student_no, count(*) as completed
  from public.division_attempts as a
  group by a.class_name, a.student_no
  order by completed desc, a.class_name asc, a.student_no asc
$$;

revoke all on function public.division_leaderboard() from public;
grant execute on function public.division_leaderboard() to anon, authenticated;
