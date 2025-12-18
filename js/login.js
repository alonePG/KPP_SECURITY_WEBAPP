// js/login.js

document.addEventListener("DOMContentLoaded", () => {

    // ✅ Step 4.1: ถ้ามี session อยู่แล้ว ให้เด้งเข้าหน้า dashboard ทันที
  const s = getAuthSession();
  if (s && s.role) {
    if (s.role === "ADMIN" || s.role === "SUPERUSER" || s.role === "MANAGER") {
      location.href = "dashboard_superuser.html";
    } else {
      location.href = "dashboard_user.html";
    }
    return; // ⬅ สำคัญ: ไม่ให้โค้ด login ด้านล่างทำงานต่อ
  }

  
  const btnLogin = document.getElementById("btnLogin");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const msg = document.getElementById("loginMessage");

  if (!btnLogin) {
    // กันกรณีไฟล์นี้ไปถูกโหลดในหน้าอื่น
    return;
  }

  btnLogin.addEventListener("click", async () => {
    // เคลียร์ข้อความเดิม
    msg.style.display = "none";
    msg.textContent = "";

    const username = (usernameInput.value || "").trim();
    const password = passwordInput.value || "";

    if (!username) {
      msg.textContent = "กรุณากรอกชื่อผู้ใช้";
      msg.style.display = "block";
      return;
    }
    if (!password) {
      msg.textContent = "กรุณากรอกรหัสผ่าน";
      msg.style.display = "block";
      return;
    }

    try {
      // เรียก API login (อยู่ใน api.js)
      const res = await apiLogin(username, password);

      if (!res || res.status !== "success") {
        msg.textContent =
          (res && res.message) || "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่";
        msg.style.display = "block";
        return;
      }

      // หลัง apiLogin สำเร็จ → บันทึก session ลง localStorage
      saveAuthSession({
        username: res.username,
        displayname: res.fullname || res.username,
        role: res.role,
        employeeId: res.employeeId,
        site: res.site,
        zone: res.zone,
        position: res.position, // ✅ เพิ่มบรรทัดนี้
      });

      // redirect ตาม role
      const role = res.role;

      // ADMIN + SUPERUSER + MANAGER → ใช้แดชบอร์ดสายตรวจ/ผู้จัดการร่วมกัน
      if (
        role === "ADMIN" ||
        role === "SUPERUSER" ||
        role === "MANAGER"
      ) {
        location.href = "dashboard_superuser.html";
      } else {
        // Default = USER (รปภ. ทั่วไป)
        location.href = "dashboard_user.html";
      }
    } catch (error) {
      console.error("Login error:", error);
      msg.textContent = "เกิดข้อผิดพลาดระหว่างการเข้าสู่ระบบ";
      msg.style.display = "block";
    }
  });

  // Enter เพื่อ login ก็ได้
  usernameInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") btnLogin.click();
  });
  passwordInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") btnLogin.click();
  });
});
