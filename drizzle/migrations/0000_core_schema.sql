create type public.app_role as enum ('developer','admin','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  preferred_language text not null default 'en',
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.prevent_suspend_self_edit()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and new.suspended is distinct from old.suspended then
    new.suspended := old.suspended;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.prevent_suspend_self_edit();

create or replace function public.handle_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do update set email = excluded.email;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  if lower(new.email) = 'imamhaider2121@gmail.com' and new.email_confirmed_at is not null then
    insert into public.user_roles (user_id, role) values (new.id, 'developer') on conflict do nothing;
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_auth_user();
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users for each row execute function public.handle_auth_user();

create table public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  event text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
grant insert on public.login_events to authenticated;
grant all on public.login_events to service_role;
alter table public.login_events enable row level security;
create policy "insert own login event" on public.login_events for insert to authenticated with check (auth.uid() = user_id);

create table public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  action text not null,
  target text,
  created_at timestamptz not null default now()
);
grant all on public.admin_audit to service_role;
alter table public.admin_audit enable row level security;

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
grant select on public.app_settings to anon, authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "public read settings" on public.app_settings for select to anon, authenticated using (true);
insert into public.app_settings (key, value) values
 ('features', '{"assistant":true,"documents":true,"quiz":true,"math":true,"notes":true,"voice":true}'),
 ('branding', '{"siteName":"Haider AI Research","tagline":"Think Deeper. Learn Smarter. Discover More."}');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null default 'New conversation',
  created_at timestamptz not null default now()
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  file_type text not null,
  page_count int,
  chunk_count int not null default 0,
  status text not null default 'processing',
  content text,
  summary text,
  created_at timestamptz not null default now()
);
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  idx int not null,
  content text not null
);
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  topic text not null,
  questions jsonb not null,
  score int,
  total int not null,
  created_at timestamptz not null default now()
);
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null default 'Untitled',
  content text not null default '',
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['conversations','messages','documents','document_chunks','quizzes','notes'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;