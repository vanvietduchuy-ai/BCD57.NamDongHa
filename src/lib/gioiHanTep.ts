// Giới hạn dung lượng một tệp tải lên (một nơi duy nhất cho mọi ô tải: văn bản PDF, tệp kèm, minh chứng nhiệm vụ, thư mục họp).
// Muốn đổi mức tối đa chỉ sửa TOI_DA_TEP_MB. Mức này phải không vượt quá giới hạn của Edge Function drive-upload và Google Drive.
export const TOI_DA_TEP_MB = 500;
export const TOI_DA_TEP = TOI_DA_TEP_MB * 1024 * 1024;
export const NHAN_TOI_DA_TEP = `${TOI_DA_TEP_MB} MB`;
export const QUA_LON = (n: number) => n > TOI_DA_TEP;
