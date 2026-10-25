-- Gắn văn bản CÓ SẴN trong kho làm minh chứng của nhiệm vụ ("Chọn trong kho").
-- Chạy MỘT LẦN trong Supabase > SQL Editor. Hàm chạy với quyền chủ sở hữu (security definer) nên không phụ thuộc
-- chính sách RLS của bảng nhiem_vu_van_ban; quyền được kiểm tra ngay trong hàm:
--   • Quản trị hệ thống / Cơ quan Thường trực (admin, quan_tri): gắn cho mọi nhiệm vụ
--   • Đơn vị: chỉ nhiệm vụ do đơn vị mình chủ trì và đã được duyệt giao
create or replace function public.nhiem_vu_chon_van_ban(p_nv uuid, p_van_ban uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_nd record;
  v_nv record;
begin
  select n.vai_tro, n.don_vi_id into v_nd from public.nguoi_dung n where n.id = auth.uid() and n.hoat_dong;
  if not found then raise exception 'Chưa đăng nhập hoặc tài khoản đã bị khoá'; end if;
  select chu_tri_don_vi_id, trang_thai_giao into v_nv from public.nhiem_vu where id = p_nv;
  if not found then raise exception 'Không tìm thấy nhiệm vụ'; end if;
  if not exists (select 1 from public.van_ban where id = p_van_ban) then raise exception 'Không tìm thấy văn bản trong kho'; end if;
  if v_nd.vai_tro not in ('admin', 'quan_tri') then
    if v_nd.vai_tro <> 'don_vi' or v_nv.chu_tri_don_vi_id is distinct from v_nd.don_vi_id or v_nv.trang_thai_giao <> 'da_duyet' then
      raise exception 'Bạn không có quyền gắn minh chứng cho nhiệm vụ này';
    end if;
  end if;
  insert into public.nhiem_vu_van_ban (nhiem_vu_id, van_ban_id) values (p_nv, p_van_ban) on conflict do nothing;
end $$;

revoke all on function public.nhiem_vu_chon_van_ban(uuid, uuid) from public;
grant execute on function public.nhiem_vu_chon_van_ban(uuid, uuid) to authenticated;
