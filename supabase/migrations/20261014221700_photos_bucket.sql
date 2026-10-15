-- Fotos dos itens, apês e viagens num bucket privado.
-- Caminho: "<household_id>/<arquivo>". Só membros do casal leem, enviam ou apagam.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "fotos: membros do casal leem" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and private.is_member_text((storage.foldername(name))[1]));

create policy "fotos: membros do casal enviam" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and private.is_member_text((storage.foldername(name))[1]));

create policy "fotos: membros do casal substituem" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and private.is_member_text((storage.foldername(name))[1]))
  with check (bucket_id = 'photos' and private.is_member_text((storage.foldername(name))[1]));

create policy "fotos: membros do casal apagam" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and private.is_member_text((storage.foldername(name))[1]));
