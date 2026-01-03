// js/dashboard_superuser.js

// โหลดหลัง DOM พร้อมแล้ว
document.addEventListener("DOMContentLoaded", () => {
  // อนุญาตเฉพาะ SUPERUSER / ADMIN
  requireRole(["SUPERUSER", "MANAGER", "ADMIN"]);

  initDashboard();    // เติมชื่อผู้ใช้บนหน้า
  initZoneDisplay();  // เติมโซนหลักของผู้ใช้
  initDateDefault();  // ตั้งค่าตั้งต้นวันที่ = วันนี้
  bindEvents();       // ผูก event ปุ่ม "โหลดข้อมูล" + zone filter

  // โหลดข้อมูลรอบแรก
  syncDutyButtons();
  loadZoneOverview();
});

/**
 * แสดงโซนของผู้ใช้ในกล่อง welcome (โซนหลักตาม USERS.sheet)
 */
function initZoneDisplay() {
  const zone = getCurrentZone() || "-";
  const el = document.getElementById("zoneName");
  if (el) el.textContent = zone;
}

/**
 * ตั้งค่า default วันที่ = วันนี้ (yyyy-MM-dd)
 */
function initDateDefault() {
  const input = document.getElementById("dateInput");
  if (!input) return;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  input.value = `${yyyy}-${mm}-${dd}`;
}

/**
 * ผูกปุ่มโหลดข้อมูล + การเปลี่ยน zoneFilter (ถ้ามี)
 */
function bindEvents() {
  const btn = document.getElementById("loadBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      loadZoneOverview();
    });
  }

  const zoneFilter = document.getElementById("zoneFilter");
  if (zoneFilter) {
    // เวลาเปลี่ยนโซน → โหลดข้อมูลใหม่
    zoneFilter.addEventListener("change", () => {
      loadZoneOverview();
    });
  }
}

/**
 * ดึงข้อมูลภาพรวมโซนจาก backend แล้วแสดงเป็นการ์ดไซต์
 * รองรับ Multi-Zone View ด้วย zoneFilter (สำหรับผู้ที่มีสิทธิ์หลายโซน)
 */
function loadZoneOverview() {
  const container = document.getElementById("zoneSitesContainer");
  const dateInput = document.getElementById("dateInput");
  if (!container || !dateInput) return;

  const date = dateInput.value || "";
  const username = getUsername();

  if (!username) {
    alert("session หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
    logout();
    return;
  }

  container.innerHTML =
    '<div class="text-muted small">กำลังโหลดข้อมูล...</div>';

  // เตรียมพารามิเตอร์เรียก API
  const params = { date, username };

  // ถ้ามี zoneFilter และถูกเปิดใช้งาน (ผู้ใช้มีสิทธิ์หลายโซน)
  const zoneFilterSelect = document.getElementById("zoneFilter");
  const zoneFilterContainer = document.getElementById("zoneFilterContainer");
  if (
    zoneFilterSelect &&
    zoneFilterContainer &&
    !zoneFilterContainer.classList.contains("d-none") &&
    zoneFilterSelect.value
  ) {
    params.zoneFilter = zoneFilterSelect.value; // "ALL" หรือชื่อโซน เช่น "ZONE-A"
  }

  // ใช้ callAPI จาก api.js (ส่งทั้ง action, date, username, zoneFilter ถ้ามี)
  callAPI("superGetZoneOverview", params)
    .then((res) => {
      if (res.status !== "success") {
        container.innerHTML =
          '<div class="text-danger small">โหลดข้อมูลไม่สำเร็จ: ' +
          (res.message || "-") +
          "</div>";
        return;
      }

      // อัปเดต UI ส่วนโซน (Multi-Zone View)
      updateZoneFilterUI(res.meta || null);

      // แสดงการ์ดไซต์
      renderZoneOverview(container, res.data || []);
    })
    .catch((err) => {
      console.error("loadZoneOverview error:", err);
      container.innerHTML =
        '<div class="text-danger small">เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์</div>';
    });
}

/**
 * จัดการ UI ของ Zone Filter + ข้อความบอกว่ากำลังดูโซนอะไร
 * meta: { allowedZones: string[], usedZones: string[] }
 */
function updateZoneFilterUI(meta) {
  const zoneFilterContainer = document.getElementById("zoneFilterContainer");
  const zoneFilterSelect = document.getElementById("zoneFilter");
  const zoneScopeInfo = document.getElementById("zoneScopeInfo");
  const currentZone = getCurrentZone() || "-";

  if (!zoneFilterContainer || !zoneFilterSelect || !zoneScopeInfo) {
    return;
  }

  const allowed = meta && Array.isArray(meta.allowedZones)
    ? meta.allowedZones
    : null;
  const usedZones = meta && Array.isArray(meta.usedZones)
    ? meta.usedZones
    : null;

  // กรณีมีสิทธิ์ดูโซนเดียว (เช่น SUPERUSER ทั่วไป)
  if (!allowed || allowed.length <= 1) {
    zoneFilterContainer.classList.add("d-none");
    zoneScopeInfo.textContent = `คุณมีสิทธิ์ดูเฉพาะโซน: ${currentZone}`;
    return;
  }

  // กรณีมีสิทธิ์หลายโซน (เช่น ADMIN / อนาคต MANAGER)
  zoneFilterContainer.classList.remove("d-none");

  // สร้างตัวเลือกใน select ใหม่ทุกครั้ง (กันข้อมูลตกหล่น)
  zoneFilterSelect.innerHTML = "";

  // ตัวเลือก "ทุกโซนที่มีสิทธิ์"
  const optAll = document.createElement("option");
  optAll.value = "ALL";
  optAll.textContent = "ทุกโซนที่มีสิทธิ์";
  zoneFilterSelect.appendChild(optAll);

  // ตัวเลือกแต่ละโซน
  allowed.forEach((z) => {
    const opt = document.createElement("option");
    opt.value = z;
    opt.textContent = z;
    zoneFilterSelect.appendChild(opt);
  });

  // เลือก default ตาม usedZones ที่ backend ใช้จริง
  let selectedValue = "ALL";
  if (usedZones && usedZones.length === 1) {
    selectedValue = usedZones[0];
  }
  zoneFilterSelect.value = selectedValue;

  // อัปเดตข้อความอธิบายขอบเขตการมองเห็น
  if (selectedValue === "ALL") {
    zoneScopeInfo.textContent =
      "กำลังแสดงข้อมูลจากทุกโซนที่คุณมีสิทธิ์";
  } else {
    zoneScopeInfo.textContent =
      `กำลังแสดงข้อมูลเฉพาะโซน: ${selectedValue}`;
  }
}

/**
 * แสดงการ์ดไซต์ในโซน
 * data: array ของ {
 *   site, zone, totalRecords, gpsProblems, missingOut, status,
 *   lateCount, earlyLeaveCount, lateAndEarlyCount,
 *   shiftSummary: { D, N },
 *   refShift,
 *   requiredD, actualD, missingD,
 *   requiredN, actualN, missingN,
 *   issues: { late[], earlyLeave[], lateAndEarly[], gps[], missingOut[] }
 * }
 */
function renderZoneOverview(container, data) {
  if (!data || data.length === 0) {
    container.innerHTML =
      '<div class="alert alert-info small mb-0">ยังไม่มีข้อมูลสำหรับวันที่นี้</div>';
    return;
  }

  container.innerHTML = "";

  // ===== helper สำหรับ staffing =====
  function fmtNum(v) {
    return v == null || v === "" ? "-" : v;
  }

  function buildStaffingLine(s) {
    // โหมด “วันนี้” → แสดงตามผลัดปัจจุบัน
    if (s.refShift === "D" || s.refShift === "N") {
      const sh = s.refShift;
      const required = sh === "D" ? s.requiredD : s.requiredN;
      const actual = sh === "D" ? s.actualD : s.actualN;
      const missing = sh === "D" ? s.missingD : s.missingN;

      return `
        <div class="small mb-1">
          👥 เวร(${sh}) ต้องมี: <strong>${fmtNum(required)}</strong> |
          มาจริง: <strong>${fmtNum(actual)}</strong> |
          ขาด: <strong>${fmtNum(missing)}</strong>
        </div>
      `;
    }

    // โหมด “ย้อนหลัง” → แสดงทั้ง 2 ผลัด
    return `
      <div class="small mb-1">
        👥 เวร(D) ต้องมี: <strong>${fmtNum(s.requiredD)}</strong> |
        มาจริง: <strong>${fmtNum(s.actualD)}</strong> |
        ขาด: <strong>${fmtNum(s.missingD)}</strong>
      </div>
      <div class="small mb-1">
        👥 เวร(N) ต้องมี: <strong>${fmtNum(s.requiredN)}</strong> |
        มาจริง: <strong>${fmtNum(s.actualN)}</strong> |
        ขาด: <strong>${fmtNum(s.missingN)}</strong>
      </div>
    `;
  }
  // ===== end helper =====

  data.forEach((s) => {
    const card = document.createElement("div");
    card.className = "card mb-2";

    const statusBadge = renderStatusBadge(s.status);
    const siteCode = s.site || "-";
    const siteName = (s.site_name || "").toString().trim();
    const zone = s.zone || "-";

    const total = s.totalRecords ?? 0;
    const gpsProblems = s.gpsProblems ?? 0;
    const missingOut = s.missingOut ?? 0;

    const lateCount = s.lateCount ?? 0;
    const earlyLeaveCount = s.earlyLeaveCount ?? 0;
    const lateAndEarlyCount = s.lateAndEarlyCount ?? 0;

    const shiftD = s.shiftSummary ? s.shiftSummary.D : 0;
    const shiftN = s.shiftSummary ? s.shiftSummary.N : 0;

    // ---- issues ----
    const issues = s.issues || {};

    function summarizeNames(list, max) {
      if (!list || list.length === 0) return "-";
      const limit = max || 3;
      const names = list.slice(0, limit).map((p) => {
        return p.fullname || p.employeeId || "-";
      });
      const extra = list.length - names.length;
      return extra > 0 ? `${names.join(", ")} +${extra} คน` : names.join(", ");
    }

    const issueLines = [];

    if (issues.late?.length) {
      issueLines.push(
        `<span class="text-danger">มาสาย:</span> ${summarizeNames(issues.late)}`
      );
    }
    if (issues.earlyLeave?.length) {
      issueLines.push(
        `<span class="text-danger">ออกก่อน:</span> ${summarizeNames(
          issues.earlyLeave
        )}`
      );
    }
    if (issues.lateAndEarly?.length) {
      issueLines.push(
        `<span class="text-danger">สาย + ออกก่อน:</span> ${summarizeNames(
          issues.lateAndEarly
        )}`
      );
    }
    if (issues.gps?.length) {
      issueLines.push(
        `<span class="text-warning">GPS ผิดปกติ:</span> ${summarizeNames(
          issues.gps
        )}`
      );
    }
    if (issues.missingOut?.length) {
      issueLines.push(
        `<span class="text-warning">ยังไม่ลงเวลาออก:</span> ${summarizeNames(
          issues.missingOut
        )}`
      );
    }

    const issuesHtml =
      issueLines.length > 0
        ? issueLines.map((ln) => `<div class="small">${ln}</div>`).join("")
        : `<div class="small text-muted">ยังไม่พบปัญหารายบุคคลในวันนี้</div>`;

    card.innerHTML = `
      <div class="card-body py-2">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div>
            <div class="fw-bold">${siteName || siteCode}</div>
            <div class="small text-muted">โซน: ${zone}</div>
          </div>
          <div>${statusBadge}</div>
        </div>

        ${buildStaffingLine(s)}

        <div class="small mb-1">
          🕒 ผลัด:
          <span class="badge bg-primary">D: ${shiftD}</span>
          <span class="badge ${shiftN > 0 ? "bg-danger" : "bg-secondary"}">
            N: ${shiftN}
          </span>
        </div>

        <div class="small mb-1">
          ⏱ รายการลงเวลา: <strong>${total}</strong> |
          มาสาย: <strong>${lateCount}</strong> |
          ออกก่อน: <strong>${earlyLeaveCount}</strong> |
          สาย+ออกก่อน: <strong>${lateAndEarlyCount}</strong>
        </div>

        <div class="small mb-2">
          📍 ปัญหา GPS: <strong>${gpsProblems}</strong> |
          ยังไม่ลงเวลาออก: <strong>${missingOut}</strong>
        </div>

        <div class="mb-2">
          ${issuesHtml}
        </div>

        <button
          class="btn btn-sm btn-outline-primary w-100 site-detail-btn"
          data-site="${siteCode}">
          ดูรายละเอียดเวรวันนี้
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  attachSiteCardEvents();
}


/**
 * ผูก event ให้ปุ่ม "ดูรายละเอียดเวรวันนี้"
 * → เด้งไปหน้า super_site_detail.html?site=...&date=...
 */
function attachSiteCardEvents() {
  const buttons = document.querySelectorAll(".site-detail-btn");
  const dateInput = document.getElementById("dateInput");
  const date = dateInput && dateInput.value ? dateInput.value : "";

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const site = btn.getAttribute("data-site");
      if (!site) return;

      let url = `super_site_detail.html?site=${encodeURIComponent(site)}`;
      if (date) {
        url += `&date=${encodeURIComponent(date)}`;
      }
      location.href = url;
    });
  });
}

/**
 * แปลงสถานะของไซต์ → badge HTML
 * รองรับสถานะใหม่ทั้งหมด 6 แบบ + fallback แบบเก่า (OK/WARN/ALERT)
 */
function renderStatusBadge(status) {
  const s = (status || "").toUpperCase();

  switch (s) {
    case "NO_DUTY":
      return `<span class="badge bg-secondary">ไม่มีเวร</span>`;

    case "NOT_STARTED":
      return `<span class="badge bg-info text-dark">ยังไม่เริ่ม</span>`;

    case "IN_PROGRESS_NOT_FULL":
      return `<span class="badge bg-warning text-dark">ยังเข้าไม่ครบ</span>`;

    case "FULL_OK":
      return `<span class="badge bg-success">ปกติ</span>`;

    case "FULL_ISSUES":
      return `<span class="badge bg-warning text-dark">เฝ้าระวัง</span>`;

    case "UNDER_STAFFED":
      return `<span class="badge bg-danger">ขาดเวร</span>`;

    /** fallback สำหรับระบบเก่า */
    case "ALERT":
      return `<span class="badge bg-danger">มีปัญหา</span>`;

    case "WARN":
      return `<span class="badge bg-warning text-dark">เฝ้าระวัง</span>`;

    case "OK":
    default:
      return `<span class="badge bg-success">ปกติ</span>`;
  }
}


// ==============================
// Sync เข้าเวร / ออกเวร ของตัวเอง (SUPERUSER/MANAGER ก็ใช้ได้)
// ใช้ getOpenShiftStatus (หาเวรค้างล่าสุด) เพื่อรองรับผลัด N ข้ามวัน
// ==============================
async function syncDutyButtons() {
  const session = getAuthSession();
  if (!session || !session.employeeId) return;

  const btnIn = document.getElementById("btnClockIn");
  const btnOut = document.getElementById("btnClockOut");
  const hint = document.getElementById("dutyHint");
  if (!btnIn || !btnOut) return;

  // helper ปิด/เปิดปุ่ม (รองรับทั้ง <a> และ <button>)
  function setDisabled(el, disabled) {
    if (!el) return;
    if (disabled) {
      el.classList.add("disabled");
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("tabindex", "-1");
    } else {
      el.classList.remove("disabled");
      el.removeAttribute("aria-disabled");
      el.removeAttribute("tabindex");
    }
  }

  try {
    const res = await callAPI("getOpenShiftStatus", { employeeId: session.employeeId });

    if (!res || res.status !== "success") {
      // ถ้าเช็กสถานะไม่ได้ ยังให้ "เข้าเวร" ได้ เผื่อแค่ status ล้ม
      setDisabled(btnIn, false);
      setDisabled(btnOut, true);
      if (hint) hint.textContent = (res && res.message) ? res.message : "ไม่สามารถตรวจสอบสถานะเวรได้";
      return;
    }

    const data = res.data || {};

    // 0) ไม่พบเวรค้าง → เข้าได้ / ออกไม่ได้
    if (!data.found) {
      setDisabled(btnIn, false);
      setDisabled(btnOut, true);
      if (hint) hint.textContent = "ไม่พบเวรที่เปิดอยู่ (ยังไม่มีเวรค้างให้ปิด)";
      return;
    }

    // 1) มีเวรค้างแต่ปิดไปแล้ว (กันแปลก ๆ)
    if (data.time_out) {
      setDisabled(btnIn, true);
      setDisabled(btnOut, true);
      if (hint) hint.textContent = "คุณได้ลงเวลาออกเวรนี้เรียบร้อยแล้ว";
      return;
    }

    // 2) มีเวรค้าง แต่ระบบไม่อนุญาตให้ปิด (เกินเวลา/ค้างนาน)
    if (data.canClockOut === false) {
      setDisabled(btnIn, true);
      setDisabled(btnOut, true);

      let msg = "ไม่สามารถปิดเวรได้";
      if (data.reason === "OPEN_SHIFT_TOO_OLD") {
        msg = "เวรค้างนานเกินกำหนด กรุณาให้หัวหน้าอนุมัติ/ปิดเวร";
      } else if (data.reason === "NIGHT_DEADLINE_PASSED") {
        msg = "เกินเวลาปิดเวรผลัด N (ไม่เกิน " + (data.deadline || "09:00") + ") กรุณาให้หัวหน้าอนุมัติ";
      } else if (data.reason) {
        msg = "ไม่สามารถปิดเวรได้: " + data.reason;
      }

      if (hint) hint.textContent = msg;
      return;
    }

    // 3) ✅ มีเวรค้าง และปิดได้ → เข้าไม่ได้ / ออกได้
    setDisabled(btnIn, true);
    setDisabled(btnOut, false);
    if (hint) hint.textContent = `เวรค้าง: เข้าเวลา ${data.time_in || "-"}`;

  } catch (err) {
    console.error("syncDutyButtons error:", err);
    // ถ้าพังจริง ให้เข้าเวรได้ แต่ออกเวรไม่ได้ (ปลอดภัยกว่า)
    setDisabled(btnIn, false);
    setDisabled(btnOut, true);
    if (hint) hint.textContent = "เกิดข้อผิดพลาดในการตรวจสอบสถานะ";
  }
}

