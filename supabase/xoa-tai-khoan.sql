-- Xoá hẳn một tài khoản (Quản trị hệ thống > Tài khoản > Xoá).
-- Chạy MỘT LẦN trong Supabase > SQL Editor.
-- Quy tắc:
--   • Chỉ Quản trị hệ thống (vai_tro = 'admin') được xoá; không tự xoá mình; không xoá quản trị hệ thống cuối cùng.
--   • Tài khoản đã có dữ liệu liên quan (báo cáo, cập nhật nhiệm vụ, văn bản… do tài khoản đó tạo) KHÔNG xoá được —
--     hàm báo rõ bảng đang giữ dữ liệu; khi đó hãy dùng "Khoá" để giữ lịch sử.
create or replace function public.xoa_tai_khoan(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_bang text;
begin
  if not exists (select 1 from public.nguoi_dung n where n.id = auth.uid() and n.vai_tro = 'admin' and n.hoat_dong) then
    raise exception 'Chỉ Quản trị hệ thống được xoá tài khoản';
  end if;
  if p_id = auth.uid() then raise exception 'Không thể tự xoá tài khoản đang dùng'; end if;
  if not exists (select 1 from public.nguoi_dung where id = p_id) then raise exception 'Không tìm thấy tài khoản'; end if;
  if (select vai_tro from public.nguoi_dung where id = p_id) = 'admin'
     and (select count(*) from public.nguoi_dung where vai_tro = 'admin' and hoat_dong and id <> p_id) = 0 then
    raise exception 'Không thể xoá Quản trị hệ thống cuối cùng';
  end if;
  begin
    delete from public.lien_he_nguoi_dung where nguoi_dung_id = p_id;
    delete from public.nguoi_dung where id = p_id;
    delete from auth.users where id = p_id;
  exception when foreign_key_violation then
    get stacked diagnostics v_bang = table_name;
    raise exception 'Tài khoản đã có dữ liệu liên quan (bảng %). Không xoá được — hãy dùng "Khoá" để giữ lịch sử.', coalesce(v_bang, '?');
  end;
end $$;

revoke all on function public.xoa_tai_khoan(uuid) from public, anon;
grant execute on function public.xoa_tai_khoan(uuid) to authenticated;
