alter table public.game_high_scores
  drop constraint if exists game_high_scores_game_id_check;

alter table public.game_high_scores
  add constraint game_high_scores_game_id_check check (game_id in (
    'arena-duel', 'meteor-dodge', 'super-jump', 'lumagrid',
    'gravibreak', 'sudoku', 'lightshade'
  ));

drop policy if exists "Visitors can submit game high scores"
  on public.game_high_scores;

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
