// super_site_detail.js (FULL FINAL VERSION)

// หน้านี้ใช้สำหรับ SUPERUSER / MANAGER / ADMIN
document.addEventListener("DOMContentLoaded", async () => {
  const mode = (getQueryParam("mode") || "").toLowerCase();
  const isLeaderMode = mode === "leader";

  // Leader mode ให้ USER เข้าได้ (หัวหน้าชุดยังเป็น USER ในระบบเรา)
  if (isLeaderMode) {
    requireRole(["USER", "SUPERUSER", "MANAGER", "ADMIN"]);
  } else {
    requireRole(["SUPERUSER", "MANAGER", "ADMIN"]);
  }

  initDashboard();

  // Leader mode: ซ่อนฟอร์มเลือกไซต์/วันที่ + ไม่ bind submit
  if (isLeaderMode) {
    hideSuperFiltersForLeader();
  } else {
    bindDetailEvents();
  }

  await initPageFromQuery(); // ✅ ใส่ await กัน race
});


// ดึง query param จาก URL
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// วันที่วันนี้รูปแบบ yyyy-MM-dd
function getTodayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ---------------------------------------------------
   โหลดรายการไซต์ตามสิทธิ์ผู้ใช้ แล้วเติมลง select#siteInput
----------------------------------------------------*/
// โหลดรายการไซต์ตามสิทธิ์ผู้ใช้ แล้วเติมลง <select id="siteInput">
async function loadSiteDropdown(username, selectedSite) {
  const sel = document.getElementById("siteInput");
  if (!sel) return;

  // ตั้งค่ารอโหลด
  sel.innerHTML = `<option>กำลังโหลด...</option>`;

  try {
    // ส่ง date ให้ GAS (จำเป็นมาก)
    const today = getTodayDateString();

    const res = await callAPI("superGetZoneOverview", {
      username: username,
      date: today
    });

    // ถ้า API ตอบ error
    if (!res || res.status !== "success") {
      console.error("superGetZoneOverview error:", res && res.message);
      sel.innerHTML = `<option value="">โหลดไซต์ไม่สำเร็จ</option>`;
      return;
    }

    // SuperAPI.getZoneOverview ส่ง "array" มาใน res.data
    const overview = res.data || [];

    // เคลียร์ dropdown
    sel.innerHTML = "";

    // เติมรายชื่อไซต์
    overview.forEach((s) => {
      const siteCode = (s.site || "").toString().trim();
      const siteName = (s.site_name || "").toString().trim();

      if (siteCode) {
        sel.innerHTML += `
      <option value="${siteCode}">
        ${siteName || siteCode}
      </option>`;
      }
    });


    // ถ้ามี site ระบุใน URL → ตั้งค่า default
    if (selectedSite) {
      sel.value = selectedSite;
    }

  } catch (err) {
    console.error("loadSiteDropdown error:", err);
    sel.innerHTML = `<option value="">เกิดข้อผิดพลาดในการโหลดไซต์</option>`;
  }
}


/* ---------------------------------------------------
   โหลดหน้าเริ่มต้นจาก URL (site + date)
----------------------------------------------------*/
async function initPageFromQuery() {
  const mode = (getQueryParam("mode") || "").toLowerCase();
  const isLeaderMode = mode === "leader";

  const siteFromURL = getQueryParam("site") || "";
  const dateFromURL = getQueryParam("date") || getTodayDateString();

  const dateInput = document.getElementById("dateInput");
  if (dateInput) {
    dateInput.value = dateFromURL;
  }

  const session = getAuthSession();
  if (!session || !session.username) {
    alert("กรุณาเข้าสู่ระบบใหม่");
    location.href = "index.html";
    return;
  }

  let actualSite = "";

  if (isLeaderMode) {
    // ✅ Leader ล็อกไซต์จาก session เท่านั้น (ไม่สน site จาก URL)
    actualSite = (session.site || "").toString().trim();
  } else {
    // ✅ Super ทำเหมือนเดิม: โหลด dropdown ตามสิทธิ์
    await loadSiteDropdown(session.username, siteFromURL);
    const siteSelect = document.getElementById("siteInput");
    actualSite = siteFromURL || (siteSelect && siteSelect.value) || "";
  }

  const container = document.getElementById("siteDetailContainer");
  const noClockinSection = document.getElementById("noClockinSection");

  if (!actualSite) {
    if (container) {
      container.innerHTML = `
        <div class="alert alert-warning">
          คุณไม่มีไซต์ที่สามารถดูได้
        </div>`;
    }
    if (noClockinSection) {
      noClockinSection.innerHTML = "";
    }
    return;
  }

  // ✅ โหลดข้อมูลไซต์ตาม site + date ที่ได้จริง
  await loadSiteDetail(actualSite, dateFromURL);
}



/* ---------------------------------------------------
   bind event ฟอร์ม "โหลดข้อมูล"
----------------------------------------------------*/
function bindDetailEvents() {
  const form = document.getElementById("filterForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const siteSelect = document.getElementById("siteInput");
    const dateInput = document.getElementById("dateInput");

    const siteCode = siteSelect ? siteSelect.value : "";
    const dateStr = dateInput ? dateInput.value : getTodayDateString();

    if (!siteCode) {
      alert("กรุณาเลือกไซต์");
      return;
    }

    // ✅ ใส่ await เพื่อกันโหลดซ้อน
    await loadSiteDetail(siteCode, dateStr);
  });
}


// === Ensure ALL_USERS cache ===
// คืนค่า:
// - array users  → โหลดสำเร็จ
// - null         → โหลดไม่สำเร็จ (API error / สิทธิ์ไม่ผ่าน / network)
async function ensureAllUsers(username, force = false) {
  // บังคับล้าง cache ถ้าระบุ force
  if (force) {
    localStorage.removeItem("ALL_USERS");
  }

  const raw = localStorage.getItem("ALL_USERS");

  // มี cache และ parse ได้ → ใช้เลย
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn("ALL_USERS cache broken, refetching...");
      localStorage.removeItem("ALL_USERS");
    }
  }

  // ยังไม่มี cache → เรียก API
  try {
    const res = await apiGetUsers(username, true);

    if (res && res.status === "success") {
      const users = res.data || [];
      localStorage.setItem("ALL_USERS", JSON.stringify(users));
      return users;
    }

    console.warn("getUsers failed:", res && res.message);
  } catch (err) {
    console.error("ensureAllUsers failed:", err);
  }

  // ❌ โหลดไม่สำเร็จ
  return null;
}




/* ---------------------------------------------------
   โหลดข้อมูลเวรของไซต์ + วันที่ จาก SuperAPI.getSiteToday
----------------------------------------------------*/
async function loadSiteDetail(siteCode, date) {
  const container = document.getElementById("siteDetailContainer");
  const noClockinSection = document.getElementById("noClockinSection");

  if (!container) return;

  const session = getAuthSession();
  if (!session || !session.username) {
    alert("กรุณาเข้าสู่ระบบใหม่");
    location.href = "index.html";
    return;
  }

  container.innerHTML = `<div class="text-muted">กำลังโหลดข้อมูล...</div>`;
  if (noClockinSection) {
    noClockinSection.innerHTML = "";
  }

  try {
    const mode = (getQueryParam("mode") || "").toLowerCase();
    const isLeaderMode = mode === "leader";

    const res = isLeaderMode
      ? await apiLeaderGetSiteToday(date, session.username)   // ✅ ใหม่ (Phase 3 ต่อไปจะสร้างใน api.js)
      : await apiSuperGetSiteToday(siteCode, date, session.username);


    if (!res || res.status !== "success") {
      const msg = (res && res.message) || "โหลดข้อมูลไม่สำเร็จ";
      container.innerHTML = `<div class="alert alert-danger">${msg}</div>`;
      if (noClockinSection) {
        noClockinSection.innerHTML = "";
      }
      return;
    }

    const payload = res.data || {};
    const records = payload.records || [];

    // ✅ จุดสำคัญ: ensure ALL_USERS ก่อน render ทุกกรณี
    await ensureAllUsers(session.username, true);

    if (!records.length) {
      container.innerHTML = `
        <div class="alert alert-info">
          ยังไม่มีข้อมูลลงเวลาในไซต์นี้สำหรับวันที่เลือก
        </div>`;
      // ถึงไม่มี log วันนี้ เราก็ยังสามารถแสดง "ยังไม่ลงเวลาเข้า" ได้
      renderNoClockinList(records, siteCode);
      return;
    }

    // มี log แล้ว → แสดงการ์ด และบล็อกคนยังไม่ลงเวลาเข้า
    container.innerHTML = renderGuardCards(records);
    renderNoClockinList(records, siteCode);

  } catch (err) {
    console.error("loadSiteDetail error:", err);
    container.innerHTML =
      `<div class="alert alert-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>`;
    if (noClockinSection) {
      noClockinSection.innerHTML = "";
    }
  }
}


/* ---------------------------------------------------
   การ์ดรายบุคคล (รูป / เวร / เวลา / เบอร์โทร)
----------------------------------------------------*/
function renderGuardCards(records) {
  let html = "";

  records.forEach((r) => {
    const employeeId = r.employeeId || "-";
    const fullname = r.fullname || "-";
    const position = r.position || "-";
    const phone = r.phone || "";
    const timeIn = r.time_in || "-";
    const timeOut = r.time_out || "-";
    const hours = r.hours || "-";
    const gps = r.gps_status || "-";
    const note = r.note || "";
    const shiftCode = r.shift_code || "";
    const workStatus = (r.work_status || "").toUpperCase();

    // รูป
    const photoIn = r.photo_in || "";
    const photoURL = r.photo_url || "";
    const isHttp = (s) => typeof s === "string" && /^https?:\/\//i.test(s);

    let imgTag = `
      <div class="no-photo-placeholder text-center bg-light border rounded mb-2"
           style="width: 90px; height: 90px; display:flex; align-items:center; justify-content:center;">
        ไม่มีรูป
      </div>`;

    if (isHttp(photoIn)) {
      imgTag = `<img src="${photoIn}" class="rounded border" style="width:90px; height:90px; object-fit:cover;">`;
    } else if (isHttp(photoURL)) {
      imgTag = `<img src="${photoURL}" class="rounded border" style="width:90px; height:90px; object-fit:cover;">`;
    }

    // แปลสถานะเวร
    let workStatusText = "";
    if (workStatus === "LATE") workStatusText = "มาสาย";
    else if (workStatus === "EARLY_LEAVE") workStatusText = "ออกก่อนเวลา";
    else if (workStatus === "LATE_AND_EARLY") workStatusText = "มาสาย + ออกก่อน";
    else if (workStatus === "NO_CLOCKIN") workStatusText = "ยังไม่ลงเวลาเข้า";
    else if (workStatus === "NO_CLOCKOUT") workStatusText = "ยังไม่ลงเวลาออก";
    else if (workStatus === "OK") workStatusText = "ปกติ";

    // สีกรอบหลักของการ์ด
    let borderClass = "border-success";
    let statusText = "ปกติ";

    if (workStatus === "NO_CLOCKIN") {
      borderClass = "border-danger";
      statusText = "ยังไม่ลงเวลาเข้า";
    } else if (gps && !gps.startsWith("IN_RANGE")) {
      borderClass = "border-warning";
      statusText = "GPS ผิดปกติ";
    } else if (workStatus && workStatus !== "OK") {
      borderClass = "border-warning";
      statusText = workStatusText;
    }

    const badgeClass =
      borderClass === "border-danger"
        ? "bg-danger"
        : borderClass === "border-warning"
          ? "bg-warning text-dark"
          : "bg-success";

    html += `
      <div class="card mb-3 ${borderClass}">
        <div class="card-body">

          <div class="d-flex gap-3">

            <div>${imgTag}</div>

            <div class="flex-grow-1">
              <div class="d-flex justify-content-between">
                <div>
                  <strong>${fullname}</strong><br>
                  <span class="small text-muted">${position}</span><br>
                  <span class="small text-muted">รหัส: ${employeeId}</span>
                </div>
                <div class="text-end">
                  ${shiftCode
        ? `<span class="badge bg-secondary">เวร: ${shiftCode}</span><br>`
        : ""
      }
                  <span class="badge ${badgeClass}">${statusText}</span>
                </div>
              </div>

              <div class="mt-2 small">
                <div>เข้า: <strong>${timeIn}</strong></div>
                <div>ออก: <strong>${timeOut}</strong></div>
                <div>ชั่วโมงรวม: <strong>${hours}</strong></div>
                <div>GPS: <span class="text-muted">${gps}</span></div>
                ${workStatusText
        ? `<div>สถานะเวร: <strong>${workStatusText}</strong></div>`
        : ""
      }
              </div>

              ${phone
        ? `<div class="mt-2 small">
                       📞 <a href="tel:${phone}">${phone}</a>
                     </div>`
        : ""
      }

              ${note
        ? `<div class="mt-2 small">
                       หมายเหตุ: <span class="text-muted">${note}</span>
                     </div>`
        : ""
      }
            </div>

          </div>
        </div>
      </div>
    `;
  });

  return html;
}

/* ---------------------------------------------------
   บล็อก "รายชื่อคนที่ยังไม่ลงเวลาเข้า"
   ใช้ ALL_USERS จาก localStorage + logs วันนี้
----------------------------------------------------*/
function renderNoClockinList(records, siteCode) {
  const section = document.getElementById("noClockinSection");
  if (!section) return;

  // คนที่มี log วันนี้ (ถือว่ามาแล้วตาม policy ปัจจุบัน)
  const clockedInIds = new Set(
    (records || []).map(r => String(r.employeeId || "").trim())
  );

  // 🔴 แยกเคส: ยังไม่ได้โหลด ALL_USERS
  const raw = localStorage.getItem("ALL_USERS");
  if (!raw) {
    section.innerHTML = `
      <div class="alert alert-warning text-center">
        ยังไม่ได้โหลดรายชื่อพนักงาน (USERS)<br>
        กรุณากลับไปหน้าแดชบอร์ด หรือ login ใหม่
      </div>`;
    return;
  }

  let allUsers = [];
  try {
    allUsers = JSON.parse(raw) || [];
  } catch (e) {
    console.error("ALL_USERS parse error:", e);
    section.innerHTML = `
      <div class="alert alert-warning text-center">
        ข้อมูลรายชื่อพนักงานผิดรูปแบบ<br>
        กรุณา login ใหม่
      </div>`;
    return;
  }

  // คนประจำไซต์จริง ๆ (จาก USERS)
  const siteUsers = allUsers.filter(u =>
    String(u.role || "").toUpperCase() === "USER" &&
    String(u.status || "").toUpperCase() === "ACTIVE" &&
    String(u.site || "").trim() === String(siteCode || "").trim()
  );

  // 🔴 แยกเคส: มี ALL_USERS แล้ว แต่ไซต์นี้ไม่มีพนักงานจริง
  if (siteUsers.length === 0) {
    section.innerHTML = `
      <div class="alert alert-secondary text-center">
        ไม่มีพนักงาน USER (ACTIVE) ประจำไซต์นี้
      </div>`;
    return;
  }

  // คนที่ยังไม่ลงเวลาเข้า
  const noClockin = siteUsers.filter(
    u => !clockedInIds.has(String(u.employeeId || "").trim())
  );

  if (noClockin.length === 0) {
    section.innerHTML = `
      <div class="alert alert-success text-center">
        พนักงานลงเวลาเข้าครบทุกคนแล้ว
      </div>`;
    return;
  }

  // render รายชื่อที่ยังไม่เข้าเวร
  let html = `
    <div class="card border-danger mb-3">
      <div class="card-header bg-danger text-white">
        ยังไม่ลงเวลาเข้า (${noClockin.length} คน)
      </div>
      <div class="card-body">
  `;

  noClockin.forEach(u => {
    const phone = u.phone || "-";
    html += `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div>
          <strong>${u.fullname}</strong><br>
          รหัส: ${u.employeeId}<br>
          เบอร์: ${phone}
        </div>
        ${u.phone
        ? `<a class="btn btn-outline-danger btn-sm" href="tel:${u.phone}">โทรหา</a>`
        : `<span class="text-muted small">(ไม่มีเบอร์)</span>`
      }
      </div>
      <hr>
    `;
  });

  html += `
      </div>
    </div>
  `;

  section.innerHTML = html;
}

function hideSuperFiltersForLeader() {
  const form = document.getElementById("filterForm");
  if (form) form.classList.add("d-none");

  // ถ้าอยากซ่อน dropdown/site/date เป็นรายชิ้น (optional)
  const siteInput = document.getElementById("siteInput");
  if (siteInput) siteInput.disabled = true;

  const dateInput = document.getElementById("dateInput");
  if (dateInput) dateInput.disabled = true;
}

// ---------------------------------------------------
// ตัดสินหน้าที่ต้องกลับ (Super vs Leader)
// ---------------------------------------------------
function getBackPage_() {
  const mode = (getQueryParam("mode") || "").toLowerCase();
  if (mode === "leader") {
    return "dashboard_user.html";
  }
  return "dashboard_superuser.html";
}

const btnBack = document.getElementById("btnBack");
if (btnBack) {
  btnBack.addEventListener("click", () => {
    window.location.href = getBackPage_();
  });
}


const navBrand = document.getElementById("navBrand");
if (navBrand) {
  navBrand.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = getBackPage_();
  });
}
