// js/clockout.js

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
  const allowed = {
    "dashboard_user.html": true,
    "dashboard_superuser.html": true,
  };

  const fromURL = (getQueryParam_("return") || "").trim();
  if (fromURL && allowed[fromURL]) return fromURL;

  return getReturnDashboardByRole_(session);
}

// เผื่อเรียกจากที่อื่น
window.getSafeReturnPage_ = getSafeReturnPage_;


document.addEventListener("DOMContentLoaded", () => {
  // อนุญาตเฉพาะ "USER","SUPERUSER","MANAGER"
  requireRole(["USER", "SUPERUSER", "MANAGER"]);
  initDashboard(); // ให้ชื่อไปโชว์ใน #displayName

  const btnClockOut = document.getElementById("btnClockOut");
  const noteInput = document.getElementById("note");
  const photoInput = document.getElementById("photoInput");
  const photoPreview = document.getElementById("photoPreview");
  const msg = document.getElementById("clockoutMessage");
  const dutySummary = document.getElementById("dutySummary");

  let photoBase64 = "";
  let session = getAuthSession();
  let isSubmitting = false;

  // ----------------------------
  // Session guard
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

  // -----------------------------
  // โหลดสถานะเวรที่ "เปิดอยู่"
  // -----------------------------
  loadOpenDuty(session.employeeId || "");

  async function loadOpenDuty(employeeId) {
    msg.style.display = "none";
    msg.className = "small mt-3";
    if (dutySummary) dutySummary.style.display = "none";

    btnClockOut.disabled = true;
    btnClockOut.classList.add("disabled");

    msg.textContent = "กำลังตรวจสอบเวรที่เปิดอยู่ของคุณ...";
    msg.classList.add("text-muted");
    msg.style.display = "block";

    try {
      const res = await apiGetTodayStatus(employeeId);

      if (!res || res.status !== "success") {
        msg.textContent = (res && res.message) || "ไม่สามารถตรวจสอบสถานะเวรวันนี้ได้";
        msg.classList.remove("text-muted");
        msg.classList.add("text-danger");
        return;
      }

      const data = res.data || {};

      if (!data.hasRecord) {
        msg.textContent = "ไม่พบเวรที่เปิดอยู่ของคุณในวันนี้ (ยังไม่ได้ลงเวลาเข้า)";
        msg.classList.remove("text-muted");
        msg.classList.add("text-danger");
        return;
      }

      if (data.time_out) {
        msg.textContent = "คุณได้ลงเวลาออกเวรนี้เรียบร้อยแล้ว เวลา " + (data.time_out || "-");
        msg.classList.remove("text-muted");
        msg.classList.add("text-success");
        return;
      }

      if (dutySummary) {
        let summary = "คุณลงเวลาเข้าไว้แล้ว เวลา " + (data.time_in || "-");
        if (data.site) summary += " ที่ไซต์ " + data.site;
        dutySummary.textContent = summary;
        dutySummary.style.display = "block";
      }

      msg.textContent = "กรุณาตรวจสอบข้อมูล และบันทึกเวลาออกเมื่อปิดเวร";
      msg.classList.add("text-muted");

      btnClockOut.disabled = false;
      btnClockOut.classList.remove("disabled");
    } catch (err) {
      console.error(err);
      msg.textContent = "เกิดข้อผิดพลาดในการตรวจสอบเวร: " + err.message;
      msg.classList.add("text-danger");
    }
  }

  // -----------------------------
  // แสดงรูปตัวอย่าง + เก็บ base64
  // -----------------------------
  photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    if (!file) {
      photoBase64 = "";
      photoPreview.style.display = "none";
      photoPreview.src = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      photoPreview.src = base64;
      photoPreview.style.display = "block";
      photoBase64 = base64.split(",")[1] || "";
    };
    reader.readAsDataURL(file);
  });

  // -----------------------------
  // กดปุ่ม "บันทึกเวลาออก"
  // -----------------------------
  btnClockOut.addEventListener("click", async () => {
    if (btnClockOut.disabled || isSubmitting) return;
    isSubmitting = true;

    msg.style.display = "none";
    msg.textContent = "";
    msg.className = "small mt-3";

    session = getAuthSession();
    if (!session) {
      alert("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
      logout();
      isSubmitting = false;
      return;
    }

    const oldBtnText = btnClockOut.textContent;
    btnClockOut.disabled = true;
    btnClockOut.classList.add("disabled");
    btnClockOut.textContent = "กำลังบันทึกเวลาออก...";

    const restoreBtn_ = () => {
      btnClockOut.disabled = false;
      btnClockOut.classList.remove("disabled");
      btnClockOut.textContent = oldBtnText || "บันทึกเวลาออก";
      isSubmitting = false;
    };

    let res;
    try {
      res = await apiClockOut({
        employeeId: session.employeeId || "",
        note: noteInput.value.trim(),
        photoBase64,
      });
    } catch (err) {
      msg.textContent = "เกิดข้อผิดพลาดในการบันทึกเวลาออก (เชื่อมต่อไม่ได้)";
      msg.classList.add("text-danger");
      msg.style.display = "block";
      restoreBtn_();
      return;
    }

    if (!res || res.status !== "success") {
      msg.textContent = (res && res.message) || "บันทึกเวลาออกไม่สำเร็จ";
      msg.classList.add("text-danger");
      msg.style.display = "block";
      restoreBtn_();
      return;
    }

    const tOut = res.data && res.data.time_out ? res.data.time_out : "";
    msg.textContent = "✅ บันทึกเวลาออกเรียบร้อย" + (tOut ? ` เวลาออก ${tOut}` : "");
    msg.classList.add("text-success");
    msg.style.display = "block";

    setTimeout(() => {
      window.location.href = getSafeReturnPage_(session);
    }, 1500);
  });
});
