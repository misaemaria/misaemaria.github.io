-- Pedidos de correção de letra enviados pelos visitantes do site.
-- Rodar uma vez no Supabase: SQL Editor → New query → colar → Run.
-- Antes, troque SEU_EMAIL_ADMIN pelo e-mail do utilizador admin
-- (criado em Authentication → Users → Add user).

create table public.correcoes (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  song_id        bigint not null,
  song_nome      text   not null check (char_length(song_nome) <= 200),
  letra_original text   not null default '' check (char_length(letra_original) <= 20000),
  letra          text   not null check (char_length(letra) between 1 and 20000),
  comentario     text   check (char_length(comentario) <= 1000),
  autor          text   check (char_length(autor) <= 60),
  status         text   not null default 'pendente' check (status in ('pendente', 'aplicada', 'descartada'))
);

alter table public.correcoes enable row level security;

-- Visitante (chave anon): só envia, sempre como pendente. Não lê nada.
create policy "visitante envia pedido" on public.correcoes
  for insert to anon
  with check (status = 'pendente');

-- Admin: lê, muda o status e apaga. Preso ao e-mail, para que outra conta
-- criada no projeto não consiga ver os pedidos.
create policy "admin le" on public.correcoes
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'SEU_EMAIL_ADMIN');

create policy "admin atualiza" on public.correcoes
  for update to authenticated
  using ((auth.jwt() ->> 'email') = 'SEU_EMAIL_ADMIN')
  with check ((auth.jwt() ->> 'email') = 'SEU_EMAIL_ADMIN');

create policy "admin apaga" on public.correcoes
  for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'SEU_EMAIL_ADMIN');
