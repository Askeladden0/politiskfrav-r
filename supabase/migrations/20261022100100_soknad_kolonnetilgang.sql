-- Attestanter kan redigere selve innholdet i en søknad, men aldri status, behandlingsfelt,
-- token eller tilhørighet. Statusendringer går bare gjennom edge functions (service role).
revoke update on public.soknader from authenticated;
grant update (
  navn, skole, e_post, telefon, type_arrangement, arrangement, har_vaert,
  dato_fra, tid_fra, dato_til, tid_til, sted, kommentar
) on public.soknader to authenticated;

-- Samme prinsipp for organisasjoner: kun profilfelt kan endres av org-admin.
-- Slug, aktiv og gmail_aktivert er forbeholdt superadmin (som bruker service-RPC under).
revoke update on public.organisasjoner from authenticated;
grant update (navn, kontakt_epost, innstillinger) on public.organisasjoner to authenticated;

create or replace function public.superadmin_oppdater_organisasjon(
  p_id uuid, p_slug text, p_aktiv boolean, p_gmail_aktivert boolean
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.er_superadmin() then
    raise exception 'Bare superadmin kan endre dette' using errcode = '42501';
  end if;
  update public.organisasjoner
     set slug = coalesce(p_slug, slug),
         aktiv = coalesce(p_aktiv, aktiv),
         gmail_aktivert = coalesce(p_gmail_aktivert, gmail_aktivert)
   where id = p_id;
end $$;
revoke execute on function public.superadmin_oppdater_organisasjon(uuid, text, boolean, boolean) from public, anon;
grant execute on function public.superadmin_oppdater_organisasjon(uuid, text, boolean, boolean) to authenticated;
