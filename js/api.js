// === CONFIG: ใส่ URL ของ GAS Web App ===
const API_URL = "https://script.google.com/macros/s/AKfycbz7-oXKEILmWW13PUMQexsKsln7i_5rYcxnQEZ47hAK0zv1FbgyeO9VANaloMLjtRL2/exec";

// === เรียก API แบบ POST ===
async function callAPI(action, data = {}) {
    try {
        const body = new URLSearchParams();
        body.append("action", action);

        // เพิ่มข้อมูลอื่น ๆ
        for (const key in data) {
            body.append(key, data[key]);
        }

        const res = await fetch(API_URL, {
            method: "POST",
            body: body,
        });

        return await res.json();
    } catch (err) {
        console.error("API ERROR:", err);
        return { status: "error", message: "ไม่สามารถเชื่อมต่อ API ได้" };
    }
}

// === API: Login จริง ===
async function apiLogin(username, password) {
    return await callAPI("login", { username, password });
}


// === API: บันทึกเวลาเข้า ===
async function apiClockIn(payload) {
  return await callAPI("clockIn", payload);
}

// === API: เช็กสถานะลงเวลาเวรปัจจุบัน ===
async function apiGetTodayStatus(employeeId) {
  return await callAPI("getTodayStatus", { employeeId });
}

// === API: ดึงประวัติลงเวลาย้อนหลัง ===
async function apiGetMyLogs(employeeId, days = 7) {
  return await callAPI("getMyLogs", { employeeId, days });
}

// === API: บันทึกเวลาออก ===
async function apiClockOut(payload) {
  return await callAPI("clockOut", payload);
}


// === API: SuperUser — สรุปภาพรวมโซน ===
async function apiSuperGetZoneOverview(date, username) {
  return await callAPI("superGetZoneOverview", { date, username });
}

// === API: SuperUser — รายละเอียดเวรของไซต์ ===
async function apiSuperGetSiteToday(site, date, username) {
  return await callAPI("superGetSiteToday", { site, date, username });
}

// === API: Leader — รายละเอียดเวรของ "หน่วยตัวเอง" (server จะล็อก site จาก session) ===
async function apiLeaderGetSiteToday(date, username) {
  return await callAPI("leaderGetSiteToday", { date, username });
}


// === API: ดึงรายชื่อพนักงานทั้งหมด (USERS) ===
async function apiGetUsers(username, onlyActive = true) {
  return await callAPI("getUsers", { username, onlyActive });
}


// === API: เช็กเวรค้างล่าสุด (สำหรับ clock-out) ===
async function apiGetOpenShiftStatus(employeeId) {
  return await callAPI("getOpenShiftStatus", { employeeId });
}
