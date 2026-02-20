-- =============================================
-- DUGOUT DRAFT ONLINE - Database Schema
-- =============================================

-- =============================================
-- Phase 1: Profiles
-- =============================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  elo_rating integer not null default 1200,
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  peak_elo integer not null default 1200,
  created_at timestamptz default now()
);

create index idx_profiles_elo on profiles(elo_rating desc);
create index idx_profiles_username on profiles(username);

alter table profiles enable row level security;

create policy "Profiles are publicly readable"
  on profiles for select
  using (true);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- =============================================
-- Phase 2: Matchmaking Queue
-- =============================================
create table matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade unique,
  elo_rating integer not null,
  joined_at timestamptz default now()
);

alter table matchmaking_queue enable row level security;

create policy "Queue is publicly readable"
  on matchmaking_queue for select
  using (true);

create policy "Users can join queue"
  on matchmaking_queue for insert
  with check (auth.uid() = profile_id);

create policy "Users can leave queue"
  on matchmaking_queue for delete
  using (auth.uid() = profile_id);

-- =============================================
-- Phase 2: Matches
-- =============================================
create table matches (
  id uuid primary key default gen_random_uuid(),
  player1_id uuid references profiles(id) not null,
  player2_id uuid references profiles(id) not null,
  status text not null default 'draft',
  phase_data jsonb,
  winner_id uuid references profiles(id),
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index idx_matches_status on matches(status);
create index idx_matches_players on matches(player1_id, player2_id);

alter table matches enable row level security;

create policy "Players can read own matches"
  on matches for select
  using (auth.uid() = player1_id or auth.uid() = player2_id);

create policy "Players can update own matches"
  on matches for update
  using (auth.uid() = player1_id or auth.uid() = player2_id);

-- Enable Realtime on matches
alter publication supabase_realtime add table matches;

-- =============================================
-- Phase 6: Match History
-- =============================================
create table match_history (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id),
  player1_id uuid references profiles(id),
  player2_id uuid references profiles(id),
  winner_id uuid references profiles(id),
  player1_elo_before integer,
  player2_elo_before integer,
  elo_change integer,
  series_score text,
  completed_at timestamptz default now()
);

create index idx_match_history_players on match_history(player1_id, player2_id);

alter table match_history enable row level security;

create policy "Match history is publicly readable"
  on match_history for select
  using (true);

-- =============================================
-- Phase 6: Career Stats
-- =============================================
create table career_stats (
  profile_id uuid references profiles(id) on delete cascade primary key,
  total_ab integer default 0,
  total_hits integer default 0,
  total_hr integer default 0,
  total_rbi integer default 0,
  total_ip numeric default 0,
  total_er integer default 0,
  total_so integer default 0
);

alter table career_stats enable row level security;

create policy "Career stats are publicly readable"
  on career_stats for select
  using (true);
