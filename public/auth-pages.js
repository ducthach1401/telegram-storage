(function () {
  const API = "/api/v1";
  const AUTH_STORAGE_KEY = "tg-drive-basic-auth";

  function readAuthCookie() {
    const m = document.cookie.match(/(?:^|;\s*)tg_drive_auth=([^;]*)/);
    if (!m?.[1]) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  }

  function persistAuth(token) {
    localStorage.setItem(AUTH_STORAGE_KEY, token);
    document.cookie = `tg_drive_auth=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  function safeNext() {
    const raw = new URLSearchParams(location.search).get("next") || "/";
    if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
    return raw;
  }

  function showAlert(el, message, isError) {
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      el.classList.remove("error");
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.classList.toggle("error", Boolean(isError));
  }

  function verifyToken(token) {
    return fetch(`${API}/auth/verify`, {
      headers: {
        Authorization: `Basic ${token}`,
        "X-Auth-Mode": "app",
      },
    }).then((res) => res.ok);
  }

  async function fetchSetupStatus() {
    try {
      const res = await fetch(`${API}/auth/setup-status`, {
        headers: { Accept: "application/json", "X-Auth-Mode": "app" },
      });
      if (!res.ok) return { needsFirstAdmin: false };
      const data = await res.json();
      return { needsFirstAdmin: Boolean(data.needsFirstAdmin) };
    } catch {
      return { needsFirstAdmin: false };
    }
  }

  void (async () => {
    const { needsFirstAdmin } = await fetchSetupStatus();

    const loginForm = document.getElementById("loginForm");
    const setupCard = document.getElementById("setupFirstAdminCard");
    const loginFootRegister = document.getElementById("loginFootRegister");
    const loginSubtitle = document.getElementById("loginBrandSubtitle");

    if (loginForm && setupCard && needsFirstAdmin) {
      loginForm.hidden = true;
      setupCard.hidden = false;
      if (loginFootRegister) loginFootRegister.hidden = true;
      if (loginSubtitle) loginSubtitle.textContent = "Khởi tạo admin đầu tiên";
    } else if (setupCard) {
      setupCard.hidden = true;
    }

    const registerFootLogin = document.getElementById("registerFootLogin");
    const registerTitle = document.getElementById("registerTitle");
    const registerDescription = document.getElementById("registerDescription");
    if (needsFirstAdmin) {
      if (registerFootLogin) registerFootLogin.hidden = true;
      if (registerTitle) registerTitle.textContent = "Đăng ký admin đầu tiên";
      if (registerDescription) {
        registerDescription.textContent =
          "Chưa có tài khoản trong hệ thống. Đây là bước duy nhất để tạo admin đầu tiên; có thể để trống Bot token / Chat ID và cấu hình sau trong Cài đặt.";
      }
    }

    if (loginForm) {
      const alertEl = document.getElementById("loginAlert");
      const params = new URLSearchParams(location.search);
      if (params.get("registered") === "1") {
        showAlert(alertEl, "Đăng ký thành công. Đăng nhập bằng tài khoản vừa tạo.", false);
      }
      const userPre = params.get("username");
      const userInput = document.getElementById("loginUser");
      if (userPre && userInput) {
        userInput.value = userPre;
      }

      if (!needsFirstAdmin) {
        const existing = localStorage.getItem(AUTH_STORAGE_KEY) || readAuthCookie();
        if (existing) {
          void verifyToken(existing).then((ok) => {
            if (ok) location.replace(safeNext());
          });
        }
      }

      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const user = document.getElementById("loginUser").value.trim();
        const pass = document.getElementById("loginPass").value;
        const submit = loginForm.querySelector('button[type="submit"]');
        if (!user || !pass) {
          showAlert(alertEl, "Nhập đủ tài khoản và mật khẩu.", true);
          return;
        }
        let token;
        try {
          token = btoa(`${user}:${pass}`);
        } catch {
          showAlert(alertEl, "Tài khoản hoặc mật khẩu có ký tự không hỗ trợ.", true);
          return;
        }
        submit.disabled = true;
        try {
          const ok = await verifyToken(token);
          if (!ok) {
            showAlert(alertEl, "Sai tài khoản hoặc mật khẩu.", true);
            return;
          }
          persistAuth(token);
          location.replace(safeNext());
        } finally {
          submit.disabled = false;
        }
      });
    }

    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
      const alertEl = document.getElementById("registerAlert");

      function syncRegisterTelegramFields() {
        const usePlatform = document.getElementById("regUsePlatform")?.checked ?? true;
        const wrap = document.getElementById("regTelegramCustomFields");
        const bot = document.getElementById("regBotToken");
        const chat = document.getElementById("regChatId");
        if (wrap) wrap.hidden = usePlatform;
        /* Telegram có thể để trống — backend báo lỗi rõ khi không phải tài khoản đầu */
        if (bot) bot.required = false;
        if (chat) chat.required = false;
      }

      const regPlatformChk = document.getElementById("regUsePlatform");
      if (regPlatformChk) {
        syncRegisterTelegramFields();
        regPlatformChk.addEventListener("change", syncRegisterTelegramFields);
      }

      registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const username = document.getElementById("regUser").value.trim();
        const password = document.getElementById("regPass").value;
        const usePlatformTelegramStorage = document.getElementById("regUsePlatform")?.checked ?? true;
        const telegramBotToken = document.getElementById("regBotToken").value.trim();
        const telegramStorageChatId = document.getElementById("regChatId").value.trim();
        const submit = registerForm.querySelector('button[type="submit"]');

        if (username.length < 2) {
          showAlert(alertEl, "Tên đăng nhập ít nhất 2 ký tự.", true);
          return;
        }
        if (password.length < 6) {
          showAlert(alertEl, "Mật khẩu ít nhất 6 ký tự.", true);
          return;
        }
        submit.disabled = true;
        try {
          const body = {
            username,
            password,
            usePlatformTelegramStorage,
            ...(usePlatformTelegramStorage
              ? {}
              : { telegramBotToken, telegramStorageChatId }),
          };
          const res = await fetch(`${API}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Auth-Mode": "app" },
            body: JSON.stringify(body),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            const msg = Array.isArray(data.message)
              ? data.message.join(", ")
              : data.message || `Lỗi ${res.status}`;
            showAlert(alertEl, msg, true);
            return;
          }
          const q = new URLSearchParams({ registered: "1", username });
          location.assign(`/login.html?${q.toString()}`);
        } finally {
          submit.disabled = false;
        }
      });
    }
  })();
})();
