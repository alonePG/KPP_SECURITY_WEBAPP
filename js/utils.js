// js/utils.js
// ฟังก์ชันช่วยเหลือทั่วไป เผื่อใช้ในอนาคต

/**
 * แสดงข้อความใน console เฉพาะตอน debug
 * ปัจจุบันเปิดไว้ตลอด ถ้าไม่อยากใช้ก็ไม่ต้องเรียก
 */
function debugLog(...args) {
  console.log("[DEBUG]", ...args);
}

/**
 * แปลงวันที่ JS Date → string (yyyy-MM-dd HH:mm:ss)
 * เผื่อใช้ตอนทำหน้ารายงานในเฟสหลัง
 */
function formatDateTime(date) {
  if (!(date instanceof Date)) return "";
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}
