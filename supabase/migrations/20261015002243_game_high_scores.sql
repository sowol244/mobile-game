create table public.game_high_scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null check (game_id in (
    'arena-duel', 'meteor-dodge', 'super-jump', 'lumagrid',
    'gravibreak', 'sudoku', 'lightshade'
  )),
  mode text not null check (mode ~ '^[a-z0-9-]{1,32}$'),
  player_name text not null check (char_length(btrim(player_name)) between 1 and 12),
  score integer not null check (score between 1 and 10000000),
  detail text not null default '' check (char_length(detail) <= 120),
  created_at timestamptz not null default now()
);

create index game_high_scores_leaderboard_idx
  on public.game_high_scores (game_id, mode, score desc, created_at asc);

alter table public.game_high_scores enable row level security;

revoke all on table public.game_high_scores from anon, authenticated;
grant select, insert on table public.game_high_scores to anon, authenticated;

create policy "Anyone can read game high scores"
  on public.game_high_scores
  for select
  to anon, authenticated
  using (true);

create policy "Visitors can submit game high scores"
  on public.game_high_scores
  for insert
  to anon, authenticated
  with check (
    game_id in (
      'arena-duel', 'meteor-dodge', 'super-jump', 'lumagrid',
      'gravibreak', 'sudoku', 'lightshade'
    )
    and mode ~ '^[a-z0-9-]{1,32}$'
    and char_length(btrim(player_name)) between 1 and 12
    and score between 1 and 10000000
    and char_length(detail) <= 120
  );
