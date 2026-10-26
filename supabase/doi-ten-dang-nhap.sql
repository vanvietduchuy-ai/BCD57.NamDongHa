-- Đổi tên đăng nhập (email) của một tài khoản (Quản trị hệ thống > Tài khoản > Sửa tên ĐN).
-- Chạy MỘT LẦN trong Supabase > SQL Editor.
-- Quy tắc:
--   • Chỉ Quản trị hệ thống (vai_tro = 'admin', đang hoạt động) được đổi.
--   • Tên mới phải có dạng ten@ten-mien, không trùng tài khoản nào khác (không phân biệt hoa/thường).
--   • Giữ nguyên mật khẩu, id và mọi dữ liệu gắn với tài khoản; người dùng đăng nhập bằng tên mới từ lần sau.
create or replace function public.doi_ten_dang_nhap(p_id uuid, p_email text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not exists (select 1 from public.nguoi_dung n where n.id = auth.uid() and n.vai_tro = 'admin' and n.hoat_dong) then
    raise exception 'Chỉ Quản trị hệ thống được đổi tên đăng nhập';
  end if;
  if not exists (select 1 from public.nguoi_dung where id = p_id) then raise exception 'Không tìm thấy tài khoản'; end if;
  if v_email !~ '^[a-z0-9._-]+@[a-z0-9.-]+$' then
    raise exception 'Tên đăng nhập không hợp lệ (chỉ dùng chữ không dấu, số, dấu chấm, gạch ngang, gạch dưới, dạng ten@ten-mien)';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email and u.id <> p_id)
     or exists (select 1 from public.nguoi_dung n where lower(n.email) = v_email and n.id <> p_id) then
    raise exception 'Tên đăng nhập "%" đã có tài khoản khác dùng', v_email;
  end if;

  update auth.users set email = v_email, updated_at = now() where id = p_id;
  update auth.identities
     set identity_data = jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_email)), updated_at = now()
   where user_id = p_id and provider = 'email';
  update public.nguoi_dung set email = v_email where id = p_id;
end $$;

revoke all on function public.doi_ten_dang_nhap(uuid, text) from public, anon;
grant execute on function public.doi_ten_dang_nhap(uuid, text) to authenticated;
