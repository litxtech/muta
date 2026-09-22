-- music-audio: yaygın ses MIME + boş/octet-stream (uzantı client’ta doğrulanır)
update storage.buckets
set
  file_size_limit = 104857600,
  allowed_mime_types = array[
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/vnd.wave',
    'audio/ogg',
    'audio/opus',
    'audio/flac',
    'audio/x-flac',
    'audio/webm',
    'audio/aiff',
    'audio/x-aiff',
    'audio/x-caf',
    'audio/amr',
    'audio/3gpp',
    'audio/x-ms-wma',
    'application/ogg',
    'application/octet-stream',
    'binary/octet-stream'
  ]
where id = 'music-audio';
