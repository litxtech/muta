-- Build öncesi: talimattaki temel özellik bayraklarını aç
update public.feature_flags set enabled = true
where key in (
  'voice_rooms_enabled',
  'live_enabled',
  'video_enabled',
  'gifts_enabled',
  'pk_enabled',
  'agency_enabled',
  'city_league_enabled',
  'city_battles_enabled',
  'city_elections_enabled',
  'messages_enabled',
  'events_enabled',
  'missions_enabled',
  'announcements_enabled',
  'policies_enabled',
  'moderation_enabled',
  'analytics_enabled',
  'iap_enabled'
);
