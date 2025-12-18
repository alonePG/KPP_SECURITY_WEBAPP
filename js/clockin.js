// js/clockin.js

// ============================
// Return Routing (GLOBAL)
// ============================
function getQueryParam_(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function getReturnDashboardByRole_(session) {
  const role = (session && session.role) ? String(session.role).toUpperCase() : "";
  if (role === "SUPERUSER" || role === "MANAGER" || role === "ADMIN") {
    return "dashboard_superuser.html";
  }
  return "dashboard_user.html";
}

function getSafeReturnPage_(session) {
  // whitelist เพื่อกัน return แปลกๆ
  const allowed = {
    "dashboard_user.html": true,
    "dashboard_superuser.html": true,
  };

  const fromURL = (getQueryParam_("return") || "").trim();
  if (fromURL && allowed[fromURL]) return fromURL;

  return getReturnDashboardByRole_(session);
}

// เผื่อเรียกจาก console/หน้าอื่น
window.getSafeReturnPage_ = getSafeReturnPage_;


document.addEventListener("DOMContentLoaded", () => {
  // เฉพาะ "USER","SUPERUSER","MANAGER" ที่ควรเข้าได้
  requireRole(["USER", "SUPERUSER", "MANAGER"]);
  initDashboard(); // ใส่ชื่อใน span#displayName

  const btnClockIn = document.getElementById("btnClockIn");
  const noteInput = document.getElementById("note");
  const photoInput = document.getElementById("photoInput");
  const photoPreview = document.getElementById("photoPreview");
  const msg = document.getElementById("clockinMessage");

  let photoBase64 = "";
  let session = getAuthSession();

  // 🟢 ตัวแปรเก็บพิกัดปัจจุบัน (STEP 2.1)
  let currentLat = null;
  let currentLng = null;
  let isSubmitting = false;

  // ----------------------------
  // Session guard (ต้องมาก่อน bind อะไรที่ใช้ session)
  // ----------------------------
  if (!session) {
    alert("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
    logout();
    return;
  }

  // ============================
  // Bind Back button (UI)
  // ============================
  const btnBackDash = document.getElementById("btnBackDash");
  if (btnBackDash) {
    btnBackDash.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = getSafeReturnPage_(session);
    });
  }

  // ============================
  // GPS helper: get location with retry
  // ============================
  function getLocationOnce_(opts) {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("อุปกรณ์ไม่รองรับ GPS"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        opts
      );
    });
  }

  async function getLocationWithRetry_({ tries = 3 } = {}) {
    // ลองแบบแม่นยำก่อน แต่ให้เวลามากขึ้น + ยอมใช้ cache ได้ (ลดโอกาส timeout)
    const hi = { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 };
    const lo = { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 };

    let lastErr = null;
    for (let i = 0; i < tries; i++) {
      try {
        const pos = await getLocationOnce_(i === 0 ? hi : lo);
        return {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("ไม่สามารถอ่านพิกัด GPS ได้");
  }

  // ============================
  // STEP 2.1: ขอพิกัด GPS ปัจจุบัน (warm-up แบบ retry + ใช้ cache ได้)
  // ============================
  (async () => {
    try {
      const loc = await getLocationWithRetry_({ tries: 2 });
      currentLat = loc.lat;
      currentLng = loc.lng;
      console.log("GPS warm-up:", currentLat, currentLng);
    } catch (err) {
      console.error("GPS warm-up error:", err);
      // ไม่บังคับตอนเปิดหน้า แค่เตือนเบาๆ
      console.warn("ยังอ่านพิกัดไม่ได้ตอนเปิดหน้า (จะไปขอตอนกดบันทึกอีกที)");
    }
  })();

  // ============================
  // STEP 2: โหลดสถานะวันนี้
  // ============================
  loadTodayStatus(session);

  // ----------------------------
  // แสดงรูปตัวอย่าง + เก็บ base64
  // ----------------------------
  photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    if (!file) {
      photoBase64 = "";
      photoPreview.style.display = "none";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result; // data:image/...;base64,xxx
      photoPreview.src = base64;
      photoPreview.style.display = "block";
      photoBase64 = base64.split(",")[1] || "";
    };
    reader.readAsDataURL(file);
  });

  // ----------------------------
  // ปุ่ม Clock-in
  // ----------------------------
  btnClockIn.addEventListener("click", async () => {
    // กันเคสปุ่มถูก disable อยู่แล้ว (บางมือถือยังยิง click ได้)
    if (btnClockIn.disabled) return;

    // กันกดรัว / double click
    if (isSubmitting) return;
    isSubmitting = true;

    msg.style.display = "none";
    msg.textContent = "";
    msg.className = "small mt-3";

    // เช็ก session เผื่อโดนลบตอนเปิดหน้านานๆ
    session = getAuthSession();
    if (!session) {
      alert("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
      logout();
      isSubmitting = false;
      return;
    }

    // ✅ ปิดปุ่มทันที (ก่อนขอ GPS/ก่อนยิง API)
    const oldBtnText = btnClockIn.textContent;
    btnClockIn.disabled = true;
    btnClockIn.classList.add("disabled");
    btnClockIn.textContent = "กำลังบันทึก...";

    // helper คืนสถานะปุ่มกรณี error
    const restoreBtn_ = () => {
      btnClockIn.disabled = false;
      btnClockIn.classList.remove("disabled");
      btnClockIn.textContent = oldBtnText || "บันทึกเวลาเข้า (Clock-in)";
      isSubmitting = false;
    };

    msg.textContent = "กำลังบันทึกเวลา...";
    msg.style.display = "block";

    // ✅ ขอ GPS ตอนกดบันทึกจริง (กัน Timeout / currentLat=null)
    try {
      const loc = await getLocationWithRetry_({ tries: 3 });
      currentLat = loc.lat;
      currentLng = loc.lng;
      console.log("GPS (on submit):", currentLat, currentLng);
    } catch (err) {
      console.error("GPS error:", err);
      msg.textContent = "ไม่พบพิกัด GPS จากอุปกรณ์ กรุณาเปิด Location แล้วลองใหม่";
      msg.classList.add("text-danger");
      restoreBtn_();
      return;
    }

    // ⭐ ส่ง GPS (lat/lng) ไปพร้อม API
    let res;
    try {
      res = await apiClockIn({
        employeeId: session.employeeId || "",
        fullname: session.displayname || session.username,
        site: session.site || "",
        note: noteInput.value.trim(),
        photoBase64,
        lat: currentLat,
        lng: currentLng,
      });
    } catch (err) {
      console.error("apiClockIn error:", err);
      msg.textContent = "เกิดข้อผิดพลาดในการบันทึกเวลา (เชื่อมต่อไม่ได้)";
      msg.classList.add("text-danger");
      restoreBtn_();
      return;
    }

    if (!res || res.status !== "success") {
      const session = getAuthSession();
      const role = (session && session.role)
        ? String(session.role).toUpperCase()
        : "USER";

      let text = (res && res.message) || "บันทึกเวลาไม่สำเร็จ";

      const isPriv = role !== "USER";
      const debug = res && res.data && res.data.debug;

      if (isPriv && debug && typeof debug === "object") {
        text += `\n\n[DEBUG]\nใกล้สุด: ${debug.nearestSite}\nห่าง: ${debug.dist_m} m (รัศมี ${debug.radius_m} m)\nGPS: ${debug.lat}, ${debug.lng}`;
      }

      msg.textContent = text;
      msg.classList.add("text-danger");

      restoreBtn_(); // ✅ คืนปุ่มให้กดใหม่ได้
      return;
    }

    msg.textContent = `✅ บันทึกสำเร็จ เวลาเข้า ${res.data.time_in} (${res.data.date})`;
    msg.classList.add("text-success");

    // ✅ success แล้วไม่ต้อง restore ปุ่ม (กำลังจะเด้งกลับ)
    setTimeout(() => {
      window.location.href = getSafeReturnPage_(session);
    }, 1500);
  });

  // ----------------------------
  // ฟังก์ชันโหลดสถานะเวรปัจจุบัน
  // ----------------------------
  async function loadTodayStatus(session) {
    msg.style.display = "none";
    msg.textContent = "";
    msg.className = "small mt-3";

    msg.textContent = "กำลังตรวจสอบสถานะวันนี้...";
    msg.style.display = "block";

    try {
      const res = await apiGetTodayStatus(session.employeeId || "");

      if (!res || res.status !== "success") {
        msg.textContent = (res && res.message) || "ไม่สามารถตรวจสอบสถานะวันนี้ได้";
        msg.classList.add("text-danger");
        return;
      }

      const data = res.data || {};

      if (data.hasRecord) {
        // มีการลงเวลาในเวรนี้แล้ว → ปิดปุ่ม
        btnClockIn.disabled = true;
        btnClockIn.classList.add("disabled");

        const tIn = data.time_in || "-";
        const date = data.dutyDate || "";
        msg.innerHTML = `✅ วันนี้คุณลงเวลาเข้าแล้ว<br>เวลา <strong>${tIn}</strong> น.<br>วันที่ <strong>${date}</strong>`;
        msg.classList.add("text-success");
      } else {
        msg.textContent = "ยังไม่ได้ลงเวลาเข้าในเวรนี้ คุณสามารถลงเวลาได้";
        msg.classList.add("text-muted");
      }
    } catch (err) {
      console.error(err);
      msg.textContent = "เกิดข้อผิดพลาดในการตรวจสอบสถานะวันนี้";
      msg.classList.add("text-danger");
    }
  }
});
