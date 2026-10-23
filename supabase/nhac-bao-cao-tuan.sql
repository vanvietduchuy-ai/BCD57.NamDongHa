-- Nhắc tự động báo cáo tuần
-- Chạy 1 lần trong Supabase → SQL Editor (cần bật extension pg_cron: Database → Extensions → pg_cron).
-- Cứ mỗi giờ hàm nhac_bao_cao_tuan() kiểm tra, đơn vị nào còn nhiệm vụ chưa báo cáo tuần thì thêm thông báo vào bảng thong_bao
-- (hiện trên chuông web, và đẩy lên điện thoại nếu hệ thống đẩy thông báo đang gắn vào bảng thong_bao như các lần nhắc tay).
-- Ba mốc: (1) 08:00 ngày liền trước hạn, (2) 07:00 sáng ngày hạn, (3) sau hạn: mỗi sáng 08:00 đến hết tuần.
-- Mỗi đơn vị chỉ nhận 1 thông báo cho mỗi mốc (chống gửi trùng bằng tiêu đề).

create or replace function public.nhac_bao_cao_tuan() returns integer
language plpgsql security definer set search_path = public as $$
declare
  ch jsonb; thu int; gio int; phut int;
  bay timestamp := (now() at time zone 'Asia/Ho_Chi_Minh');          -- giờ VN dạng không múi giờ
  dau_tuan timestamp := date_trunc('week', (now() at time zone 'Asia/Ho_Chi_Minh'));
  han timestamp; so_tuan text; tien_to text; mocn text; tieu text; nd text; n int := 0;
  r record;
begin
  select gia_tri::jsonb into ch from cau_hinh where khoa = 'bao_cao_tuan';
  if ch is not null and coalesce((ch->>'bat')::boolean, true) = false then return 0; end if;
  thu := coalesce((ch->>'thu')::int, 5); gio := coalesce((ch->>'gio')::int, 17); phut := coalesce((ch->>'phut')::int, 0);
  han := dau_tuan + make_interval(days => thu - 1, hours => gio, mins => phut);
  so_tuan := to_char(dau_tuan + interval '3 days', 'IW')::int::text || '/' || to_char(dau_tuan + interval '3 days', 'IYYY');
  tien_to := 'Báo cáo tuần ' || so_tuan || ':';

  -- Xác định mốc nhắc hiện tại
  if bay >= han then
    if bay < dau_tuan + interval '7 days' and bay::time >= time '08:00' then mocn := 'sau hạn ' || to_char(bay, 'DD/MM'); end if;
  elsif bay >= date_trunc('day', han) + interval '7 hours' then mocn := 'sáng ngày hạn';
  elsif bay >= date_trunc('day', han) - interval '16 hours' then mocn := 'trước hạn 1 ngày';   -- từ 08:00 ngày liền trước
  end if;
  if mocn is null then return 0; end if;

  tieu := 'Nhắc báo cáo tuần ' || so_tuan || ' (' || mocn || ')';
  nd := case when bay >= han then 'Đã quá hạn báo cáo tuần ' else 'Sắp đến hạn báo cáo tuần ' end || so_tuan || ' (hạn ' || to_char(han, 'HH24:MI DD/MM/YYYY')
        || '). Đề nghị đơn vị nhập kết quả các nhiệm vụ được giao chủ trì.';

  for r in
    select distinct nv.chu_tri_don_vi_id as don_vi_id
    from nhiem_vu nv
    where nv.trang_thai_giao = 'da_duyet' and nv.chu_tri_don_vi_id is not null
      and nv.trang_thai not in ('hoan_thanh', 'tam_dung')
      -- nhiệm vụ lớn có nhiệm vụ con không tự báo cáo
      and nv.id::text not in (
        select d.value->>'cha' from cau_hinh c, jsonb_each(c.gia_tri::jsonb->'dong') d
        where c.khoa = 'danh_muc_a4' and d.value ? 'cha')
      -- chưa có báo cáo tuần này (hoặc lần gần nhất là lần rút)
      and not exists (
        select 1 from (
          select u.noi_dung from nhiem_vu_cap_nhat u
          where u.nhiem_vu_id = nv.id and u.noi_dung like tien_to || '%'
          order by u.luc desc limit 1) l
        where l.noi_dung not like '%Đơn vị rút báo cáo%')
  loop
    if not exists (select 1 from thong_bao t where t.don_vi_id = r.don_vi_id and t.tieu_de = tieu) then
      insert into thong_bao (don_vi_id, tieu_de, noi_dung, duong_dan) values (r.don_vi_id, tieu, nd, '/nhiem-vu?tab=chua_bct');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- Lên lịch: mỗi giờ (phút thứ 5). Chạy lại câu này nếu cần đặt lại lịch.
select cron.unschedule('nhac-bao-cao-tuan') where exists (select 1 from cron.job where jobname = 'nhac-bao-cao-tuan');
select cron.schedule('nhac-bao-cao-tuan', '5 * * * *', $$select public.nhac_bao_cao_tuan()$$);

-- Chạy thử ngay (trả về số thông báo đã tạo):  select public.nhac_bao_cao_tuan();
