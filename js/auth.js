// js/auth.js

const AUTH_STORAGE_KEY = "security_app_auth";
const AUTH_SESSION_DAYS = 7; // อายุ session 7 วัน (ปรับได้)


/**
 * อ่าน session ปัจจุบันจาก localStorage
 * + เช็คหมดอายุอัตโนมัติ
 */
function getAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw);

    // ✅ ถ้ามีวันหมดอายุ และเลยเวลาแล้ว → ล้าง session
    if (session.expiresAt && Date.now() > session.expiresAt) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return session;
  } catch (e) {
    console.error("อ่าน session ไม่ได้:", e);
    return null;
  }
}


/**
 * บันทึก session หลัง login สำเร็จ
 * session ควรมีอย่างน้อย:
 *  - username
 *  - fullname หรือ displayname
 *  - role
 *  - employeeId (optional)
 *  - site (optional)
 *  - zone (optional)
 */
function saveAuthSession(session) {
  if (!session || !session.role) return;

  const displayname =
    session.displayname ||
    session.fullname ||
    session.username ||
    "-";
  // ✅ ต้องมี 2 บรรทัดนี้
  const now = Date.now();
  const expiresAt = now + AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000;
  const dataToSave = {
    username: session.username,
    displayname: displayname,
    role: session.role,
    employeeId: session.employeeId || null,
    site: session.site || null,
    zone: session.zone || null,
    position: session.position || null,

    // ✅ เพิ่ม 2 บรรทัดนี้
    loginAt: now,
    expiresAt: expiresAt,
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(dataToSave));
}

/**
 * ล้าง session (ใช้ตอน logout)
 */
function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * คืน role ปัจจุบัน (string หรือ null)
 */
function getCurrentRole() {
  const session = getAuthSession();
  return session ? session.role : null;
}

/**
 * คืนชื่อที่ใช้แสดงผล
 */
function getDisplayName() {
  const session = getAuthSession();
  return session && session.displayname ? session.displayname : "-";
}

/**
 * คืน username (สำหรับใช้ต่อในอนาคต)
 */
function getUsername() {
  const session = getAuthSession();
  return session && session.username ? session.username : null;
}

/**
 * คืน site ปัจจุบันของ user (ถ้ามี)
 */
function getCurrentSite() {
  const session = getAuthSession();
  return session && session.site ? session.site : null;
}

/**
 * คืน zone ปัจจุบันของ user (สำคัญสำหรับ SUPERUSER)
 */
function getCurrentZone() {
  const session = getAuthSession();
  return session && session.zone ? session.zone : null;
}

/**
 * helper เช็คว่า user ปัจจุบันเป็น SUPERUSER หรือไม่
 */
function isSuperUser() {
  return getCurrentRole() === "SUPERUSER";
}

/**
 * logout แล้วกลับไปหน้า Login
 */
function logout() {
  clearAuthSession();
  location.href = "index.html";
}

/**
 * ใช้ในแต่ละหน้า dashboard เพื่อให้แน่ใจว่า role ถูกต้อง
 * requiredRoles: string หรือ array เช่น "ADMIN" หรือ ["USER","SUPERUSER"]
 */
function requireRole(requiredRoles) {
  const role = getCurrentRole();
  if (!role) {
    alert("กรุณาเข้าสู่ระบบอีกครั้ง");
    location.href = "index.html";
    return;
  }


  let allowed = [];
  if (Array.isArray(requiredRoles)) {
    allowed = requiredRoles;
  } else if (typeof requiredRoles === "string") {
    allowed = [requiredRoles];
  } else {
    console.error("requireRole: requiredRoles ผิดรูปแบบ", requiredRoles);
    allowed = [];
  }

  if (allowed.indexOf(role) === -1) {
    alert("คุณไม่มีสิทธิ์เข้าหน้านี้");
    location.href = "index.html";
  }
}

/**
 * ใช้ในแต่ละ dashboard เพื่อเติมชื่อบนหน้า
 */
function initDashboard() {
  const nameEl = document.getElementById("displayName");
  if (nameEl) {
    nameEl.textContent = getDisplayName();
  }
}


function getCurrentPosition() {
  const session = getAuthSession();
  return session && session.position ? session.position : null;
}
