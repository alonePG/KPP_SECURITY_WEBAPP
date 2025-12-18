// js/dashboard_user.js
document.addEventListener("DOMContentLoaded", () => {
  // อนุญาตเฉพาะ "USER","SUPERUSER","MANAGER"
  requireRole(["USER", "SUPERUSER", "MANAGER"]);
  initDashboard();

  const session = getAuthSession();
  if (!session) {
    alert("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
    logout();
    return;
  }

  // ------------------------------
  // Leader Button: โชว์เฉพาะหัวหน้าชุด
  // ------------------------------
  const btnLeader = document.getElementById("btnLeaderSite");
  const position = getCurrentPosition(); // อ่านจาก session
  if (btnLeader && position === "หัวหน้าชุด") {
    btnLeader.classList.remove("d-none");
  }

  // โหลดสถานะวันนี้ + โหลด log ย้อนหลัง
  loadTodayStatus(session.employeeId);
  loadMyLogs(session.employeeId, 7);

  // ------------------------------
  // โหลดสถานะเวรวันนี้
  // ------------------------------
  async function loadTodayStatus(employeeId) {
    const msgBox = document.getElementById("todayStatusMessage");
    const btnIn = document.getElementById("btnGotoClockIn");
    const btnOut = document.getElementById("btnGotoClockOut");

    if (!msgBox || !btnIn || !btnOut) return;

    msgBox.textContent = "กำลังตรวจสอบสถานะเวรวันนี้...";

    try {
      const res = await apiGetTodayStatus(employeeId);

      if (!res || res.status !== "success") {
        msgBox.innerHTML =
          '<span class="text-danger">ไม่สามารถตรวจสอบสถานะเวรวันนี้ได้</span>';
        return;
      }

      const data = res.data || {};

      if (!data.hasRecord) {
        // ยังไม่ลงเวลาเข้า → เปิดเฉพาะปุ่มเข้า
        btnIn.classList.remove("disabled");
        btnOut.classList.add("disabled");
        msgBox.innerHTML =
          '<span class="text-muted">ยังไม่ได้ลงเวลาเข้าในเวรนี้</span>';
        return;
      }

      // ลงเวลาเข้าแล้ว
      btnIn.classList.add("disabled");

      if (data.time_out) {
        // มีเวลาออกแล้ว → ปิดทั้งคู่
        btnOut.classList.add("disabled");
        msgBox.innerHTML =
          `<span class="text-success">คุณลงเวลาเข้าแล้ว (${data.time_in}) และลงเวลาออกแล้ว (${data.time_out})</span>`;
      } else {
        // ยังไม่ลงเวลาออก → เปิดเฉพาะปุ่มออก
        btnOut.classList.remove("disabled");
        msgBox.innerHTML =
          `<span class="text-success">คุณลงเวลาเข้าแล้ว เวลา ${data.time_in}</span>`;
      }
    } catch (err) {
      console.error(err);
      msgBox.innerHTML =
        '<span class="text-danger">เกิดข้อผิดพลาดในการตรวจสอบเวร</span>';
    }
  }

  // ------------------------------
  // โหลดประวัติย้อนหลัง
  // ------------------------------
  async function loadMyLogs(employeeId, days) {
    const tbody = document.getElementById("myLogsBody");
    if (!tbody) return;

    tbody.innerHTML =
      '<tr><td colspan="5" class="text-muted small">กำลังโหลดประวัติ...</td></tr>';

    try {
      const res = await apiGetMyLogs(employeeId, days);

      if (!res || res.status !== "success") {
        tbody.innerHTML =
          '<tr><td colspan="5" class="text-danger small">โหลดประวัติไม่สำเร็จ</td></tr>';
        return;
      }

      const logs = (res.data && res.data.logs) || [];
      if (!logs.length) {
        tbody.innerHTML =
          '<tr><td colspan="5" class="text-muted small">ยังไม่มีประวัติในช่วง 7 วันที่ผ่านมา</td></tr>';
        return;
      }

      tbody.innerHTML = "";

      logs.forEach((item) => {
        const tr = document.createElement("tr");

        let shiftClass = "";
        if (item.shift === "D") shiftClass = "shift-badge shift-day";
        else if (item.shift === "N") shiftClass = "shift-badge shift-night";

        tr.innerHTML = `
          <td class="font-mono">${item.date || "-"}</td>
          <td class="font-mono">${item.time_in || "-"}</td>
          <td><span class="${shiftClass}">${item.shift || "-"}</span></td>
          <td>${item.site || "-"}</td>
          <td class="note-text">${item.note || "-"}</td>
        `;

        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      tbody.innerHTML =
        '<tr><td colspan="5" class="text-danger small">เกิดข้อผิดพลาดในการโหลดประวัติ</td></tr>';
    }
  }
});
