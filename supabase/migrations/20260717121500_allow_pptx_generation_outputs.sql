update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/png',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
where id = 'ppt-generations';
