begin;

create extension if not exists pgcrypto;

-- 既存の source を単一利用者前提の default user subscription へ移行する。
-- 再実行時の整合は固定 ID ではなく unique 制約と存在確認で担保する。

insert into users (
  id,
  slug
)
select
  gen_random_uuid(),
  'default'
where not exists (
  select 1
  from users
  where slug = 'default'
);

insert into subscriptions (
  id,
  user_id,
  source_id,
  collection_id,
  position
)
select
  gen_random_uuid(),
  users.id,
  sources.id,
  null,
  0
from sources
cross join (
  select id
  from users
  where slug = 'default'
) as users
where not exists (
  select 1
  from subscriptions
  where subscriptions.user_id = users.id
    and subscriptions.source_id = sources.id
);

insert into subscription_events (
  id,
  user_id,
  source_id,
  kind,
  occurred_at
)
select
  gen_random_uuid(),
  subscriptions.user_id,
  subscriptions.source_id,
  'subscribed',
  subscriptions.created_at
from subscriptions
inner join users
  on users.id = subscriptions.user_id
where users.slug = 'default'
  and not exists (
    select 1
    from subscription_events
    where subscription_events.user_id = subscriptions.user_id
      and subscription_events.source_id = subscriptions.source_id
      and subscription_events.kind = 'subscribed'
  );

commit;
