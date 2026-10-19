// Đọc tệp Word (.docx): lấy số, ký hiệu, ngày ban hành, loại, trích yếu, cơ quan ban hành, người ký.
// Dựng lại "trang" giả lập như PDF (bảng phần đầu / phần ký: ô trái - ô phải; căn giữa; in đậm) rồi dùng chung bộ phân tích của docPdf.
import { phanTich, type Dong, type MetaVb, type Trang } from './docPdf';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const RONG = 600, CAO = 850, CO = 13, DONG = CO * 1.35;
const nfc = (s: string) => s.normalize('NFC').replace(/[\s ]+/g, ' ').trim();

async function docXml(f: File, ten: string): Promise<string | null> {
  const mod = await import('xlsx');
  const XLSX = (mod as { CFB?: unknown }).CFB ? mod : (mod as unknown as { default: typeof mod }).default;
  const cfb = XLSX.CFB.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' });
  const e = XLSX.CFB.find(cfb, ten) ?? XLSX.CFB.find(cfb, `/${ten}`);
  return e?.content ? new TextDecoder('utf-8').decode(e.content as Uint8Array) : null;
}

const con = (el: Element, ten: string) => Array.from(el.children).filter((x) => x.localName === ten);
const mot = (el: Element | undefined, ten: string) => (el ? Array.from(el.children).find((x) => x.localName === ten) : undefined);
const bat = (el: Element | undefined) => !!el && !/^(0|false|off)$/i.test(el.getAttributeNS(W, 'val') ?? el.getAttribute('w:val') ?? '');

// Kiểu đoạn in đậm (styles.xml): tên kiểu -> có in đậm
function kieuDam(stylesXml: string | null): Set<string> {
  const s = new Set<string>();
  if (!stylesXml) return s;
  const d = new DOMParser().parseFromString(stylesXml, 'application/xml');
  for (const st of Array.from(d.getElementsByTagNameNS(W, 'style'))) {
    if (bat(mot(mot(st, 'rPr'), 'b'))) s.add(st.getAttributeNS(W, 'styleId') ?? st.getAttribute('w:styleId') ?? '');
  }
  return s;
}

type DoanChu = { dong: { text: string; dam: boolean | undefined }[]; canh: 'trai' | 'giua' | 'phai' };
// Một đoạn văn -> các dòng (tách theo ngắt dòng), in đậm khi phần lớn chữ in đậm
function docDoan(p: Element, dam: Set<string>): DoanChu {
  const pPr = mot(p, 'pPr');
  const jc = mot(pPr, 'jc')?.getAttributeNS(W, 'val') ?? mot(pPr, 'jc')?.getAttribute('w:val') ?? '';
  const kieu = mot(pPr, 'pStyle')?.getAttributeNS(W, 'val') ?? '';
  const damDoan = dam.has(kieu) || bat(mot(mot(pPr, 'rPr'), 'b'));
  const dong: DoanChu['dong'] = [];
  let chu = '', soDam = 0, soChu = 0, coThongTin = damDoan;
  const xong = () => { const t = nfc(chu); if (t) dong.push({ text: t, dam: coThongTin ? soDam * 2 >= soChu : undefined }); chu = ''; soDam = 0; soChu = 0; };
  const r_ = (r: Element) => {
    const rPr = mot(r, 'rPr'); const b = mot(rPr, 'b');
    const laDam = b ? bat(b) : damDoan;
    if (b) coThongTin = true;
    for (const x of Array.from(r.children)) {
      if (x.localName === 't') { const t = x.textContent ?? ''; chu += t; const n = t.replace(/\s/g, '').length; soChu += n; if (laDam) soDam += n; }
      else if (x.localName === 'tab') chu += ' ';
      else if (x.localName === 'br' || x.localName === 'cr') xong();
    }
  };
  // run nằm trực tiếp hoặc trong hyperlink / smartTag / ins
  const duyet = (el: Element) => { for (const x of Array.from(el.children)) { if (x.localName === 'r') r_(x); else if (['hyperlink', 'smartTag', 'ins', 'sdt', 'sdtContent', 'fldSimple'].includes(x.localName)) duyet(x); } };
  duyet(p);
  xong();
  return { dong, canh: jc === 'center' ? 'giua' : jc === 'right' || jc === 'end' ? 'phai' : 'trai' };
}

export async function docVanBanWord(file: File): Promise<MetaVb> {
  if (!/\.docx$/i.test(file.name)) throw new Error('Chỉ đọc được tệp .docx (Word 2007 trở lên). Tệp .doc cũ: mở bằng Word rồi lưu lại dạng .docx.');
  const [xml, styles] = await Promise.all([docXml(file, 'word/document.xml'), docXml(file, 'word/styles.xml')]);
  if (!xml) throw new Error('Không đọc được nội dung tệp Word.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  if (!body) throw new Error('Tệp Word không có nội dung.');
  const dam = kieuDam(styles);
  const ds: Dong[] = [];
  let y = 40;

  // Đặt một đoạn vào vùng [x0, x1] tại y; trả về y sau đoạn
  const dat = (d: DoanChu, x0: number, x1: number, yy: number) => {
    if (!d.dong.length) return yy + DONG * 0.6;                                     // đoạn trống: khoảng cách
    for (const l of d.dong) {
      const w = Math.min(x1 - x0, l.text.length * CO * 0.48);
      const x = d.canh === 'giua' ? x0 + (x1 - x0 - w) / 2 : d.canh === 'phai' ? x1 - w : x0;
      ds.push({ text: l.text, x, y: yy, w, co: CO, dam: l.dam });
      yy += DONG;
    }
    return yy;
  };
  const datKhoi = (el: Element, x0: number, x1: number, yy: number): number => {
    for (const x of Array.from(el.children)) {
      if (x.localName === 'p') yy = dat(docDoan(x, dam), x0, x1, yy);
      else if (x.localName === 'tbl') yy = datBang(x, x0, x1, yy);
      else if (x.localName === 'sdt') yy = datKhoi(mot(x, 'sdtContent') ?? x, x0, x1, yy);
    }
    return yy;
  };
  // Bảng (phần đầu, phần ký): chia đều bề ngang theo số ô của hàng; các ô cùng hàng bắt đầu cùng độ cao
  const datBang = (tbl: Element, x0: number, x1: number, yy: number): number => {
    for (const tr of con(tbl, 'tr')) {
      const o = con(tr, 'tc');
      const n = Math.max(1, o.length);
      let cuoi = yy;
      o.forEach((tc, i) => { cuoi = Math.max(cuoi, datKhoi(tc, x0 + ((x1 - x0) * i) / n, x0 + ((x1 - x0) * (i + 1)) / n, yy)); });
      yy = cuoi;
    }
    return yy;
  };
  y = datKhoi(body, 40, RONG - 40, y);

  ds.sort((a, b) => a.y - b.y || a.x - b.x);
  const trang: Trang = { rong: RONG, cao: CAO, dong: ds };   // chiều cao chuẩn 1 trang A4 cho các tỉ lệ vùng phần đầu
  const m = phanTich([trang], false, 1);
  if (!m.trich_yeu) {
    // Dự phòng: đoạn in đậm, căn giữa ngay sau tên loại văn bản / dòng "V/v"
    const iVv = ds.findIndex((d) => /^V\/v\b/i.test(d.text));
    if (iVv >= 0) m.trich_yeu = ds[iVv].text.replace(/^V\/v\s*/i, '');
  }
  return m;
}
