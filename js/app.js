(() => {
  "use strict";

  const config = window.CORNER_CONFIG;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const dialog = $("#feature-dialog");
  const dialogContent = $("#dialog-content");
  const dialogKicker = $("#dialog-kicker");
  const memoryState = { category: "Ngẫu nhiên", previousNote: "", memoryIndex: 0 };
  const temporaryStorage = new Map();
  let toastTimer;
  let catchTimer;
  let memoryTimer;
  let gameCleanup = [];
  let storageWarningShown = false;
  let currentCardTheme = "pastel";
  let currentCardEmoji = "💗";
  let musicTrackIndex = 0;

  /* ── Storage ──────────────────────────────────────────── */
  const storage = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(`corner:${key}`);
        if (value === null) return fallback;
        return JSON.parse(value);
      } catch {
        return temporaryStorage.has(key) ? temporaryStorage.get(key) : fallback;
      }
    },
    set(key, value) {
      temporaryStorage.set(key, value);
      try {
        localStorage.setItem(`corner:${key}`, JSON.stringify(value));
      } catch {
        if (!storageWarningShown) {
          storageWarningShown = true;
          toast("Không thể lưu trên thiết bị này; thay đổi chỉ còn trong phiên hiện tại.");
        }
      }
    }
  };

  /* ── Toast notification ───────────────────────────────── */
  function toast(message) {
    const region = $("#toast-region");
    if (!region) return;
    const item = document.createElement("div");
    item.className = "toast";
    item.textContent = message;
    region.append(item);
    window.setTimeout(() => {
      item.style.opacity = "0";
      item.style.transform = "translateY(8px) scale(.96)";
      item.style.transition = "opacity .2s, transform .2s";
      window.setTimeout(() => item.remove(), 220);
    }, 2600);
  }

  /* ── Sparkle burst particles ──────────────────────────── */
  function burst(target = document.body, icon = "✦") {
    const rect = target instanceof Element ? target.getBoundingClientRect() : null;
    const cx = rect ? rect.left + rect.width  / 2 : innerWidth  / 2;
    const cy = rect ? rect.top  + rect.height / 2 : innerHeight / 2;
    const icons  = [icon, "✦", "·", "♡", "✧"];
    const colors = ["#D97BA0", "#C4BBEC", "#E8B748", "#F5C7AD", "#B85C7E"];
    const count  = icon === "♡" ? 9 : 7;

    for (let i = 0; i < count; i++) {
      const particle = document.createElement("span");
      particle.className = "sparkle-burst";
      particle.textContent = icons[i % icons.length];
      particle.style.cssText = `
        left: ${cx + (Math.random() - .5) * 110}px;
        top:  ${cy + (Math.random() - .5) * 45}px;
        color: ${colors[i % colors.length]};
        font-size: ${12 + Math.random() * 14}px;
        animation-duration: ${.7 + Math.random() * .5}s;
        animation-delay: ${Math.random() * .12}s;
      `;
      document.body.append(particle);
      window.setTimeout(() => particle.remove(), 1200);
    }
  }

  /* ── Sanitise user-provided text ─────────────────────── */
  function safeText(value) {
    return String(value).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  /* ── Game cleanup ─────────────────────────────────────── */
  function cleanupGame() {
    gameCleanup.forEach((fn) => fn());
    gameCleanup = [];
    window.clearInterval(catchTimer);
    window.clearTimeout(memoryTimer);
  }

  /* ── Garden state ─────────────────────────────────────── */
  function getGarden() {
    return {
      water: 0, sun: 0, love: 0,
      flower: false, stars: 0, decorations: 0,
      ...storage.get("garden", {})
    };
  }

  /* ── Dialog helpers ───────────────────────────────────── */
  function showDialog(title, kicker, markup) {
    cleanupGame();
    dialogKicker.textContent = kicker;
    dialogContent.innerHTML = `<h2 id="dialog-title">${title}</h2>${markup}`;
    if (!dialog.open) dialog.showModal();
    dialogContent.scrollTop = 0;
    // Stagger entrance for direct children of dialog-content
    requestAnimationFrame(() => {
      $$(".dialog-content > *", dialog).forEach((el, i) => {
        el.style.opacity = "0";
        el.style.transform = "translateY(14px)";
        el.style.transition = `opacity .32s ease ${.05 + i * .06}s, transform .36s ease ${.05 + i * .06}s`;
        requestAnimationFrame(() => {
          el.style.opacity = "";
          el.style.transform = "";
        });
      });
    });
  }

  function closeDialog() {
    cleanupGame();
    if (dialog.open) dialog.close();
  }

  function goHome() {
    closeDialog();
    $("#home").scrollIntoView({ behavior: "smooth", block: "start" });
    updateNav("home");
  }

  function updateNav(key) {
    $$(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.open === key));
  }

  /* ── Dynamic greeting ─────────────────────────────────── */
  function greeting() {
    const hour       = new Date().getHours();
    const salutation = hour < 11 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
    const flower     = hour < 11 ? "🌸" : hour < 18 ? "🌷" : "🌙";
    $("#greeting-title").innerHTML =
      `${salutation}, <span data-recipient>${safeText(config.recipient)}</span> <span aria-hidden="true">${flower}</span>`;
    $$("[data-recipient]").forEach((node) => { node.textContent = config.recipient; });

    const now  = new Date();
    $("#today-label").textContent = new Intl.DateTimeFormat("vi-VN", {
      weekday: "long", day: "numeric", month: "long"
    }).format(now).toLocaleUpperCase("vi-VN");

    const daySeed = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
    $("#daily-quote").textContent = config.quotes[daySeed % config.quotes.length];

    $("#welcome-copy").textContent    = config.openingMessage;
    $("#welcome-signature").textContent = `Gửi cậu, từ ${config.sender} ♡`;
  }

  /* ── Start experience (welcome → app) ─────────────────── */
  function startExperience() {
    const screen   = $("#welcome-screen");
    const appShell = $("#app-shell");
    const nav      = $("#bottom-nav");

    // Fade out welcome
    screen.style.transition = "opacity .45s ease, transform .45s ease";
    screen.style.opacity    = "0";
    screen.style.transform  = "scale(.98)";

    window.setTimeout(() => {
      screen.hidden   = true;
      screen.style.cssText = "";
      appShell.hidden = false;
      nav.hidden      = false;
      greeting();

      // Stagger in hero + sections
      $$(".hero, .section-block, .site-footer", appShell).forEach((el, i) => {
        el.style.opacity   = "0";
        el.style.transform = "translateY(22px)";
        el.style.transition = `opacity .5s ease ${i * .12}s, transform .5s ease ${i * .12}s`;
        requestAnimationFrame(() => {
          el.style.opacity   = "";
          el.style.transform = "";
        });
      });
    }, 450);
  }

  /* ── Feature titles ───────────────────────────────────── */
  const featureTitles = {
    mood     : ["Trái tim cậu hôm nay đang ở đâu nhỉ?", "MỘT CHÚT LẮNG NGHE"],
    notes    : ["Một chiếc thư dành cho cậu", "HỘP THƯ YÊU THƯƠNG"],
    hug      : ["Gửi cậu một cái ôm", "NÚT ÔM KHẨN CẤP"],
    games    : ["Chơi một chút nhé", "GÓC TRÒ CHƠI NHỎ"],
    garden   : ["Khu vườn của cậu", "GÓC XANH BÌNH YÊN"],
    memories : ["Những điều mình muốn nhớ", "ALBUM SCRAPBOOK"],
    music    : ["Một chút dịu dàng", "MÁY NGHE NHẠC NHỎ"],
    wishes   : ["Điều ước hôm nay", "GỬI MONG MUỐN LÊN TRỜI"],
    card     : ["Tạo một tấm thiệp", "MÓN QUÀ TỰ TAY LÀM"],
    gifts    : ["Mở một chiếc hộp nhé", "BẤT NGỜ NHO NHỎ"],
    settings : ["Tùy chọn của cậu", "MỌI THỨ THEO CÁCH CỦA CẬU"]
  };

  function openFeature(key) {
    if (key === "home") { goHome(); return; }
    const title = featureTitles[key];
    if (!title) return;
    updateNav(key);
    const renderers = {
      mood: renderMood, notes: renderNotes, hug: renderHug, games: renderGames,
      garden: renderGarden, memories: renderMemories, music: renderMusic,
      wishes: renderWishes, card: renderCard, gifts: renderGifts, settings: renderSettings
    };
    showDialog(title[0], title[1], renderers[key]());
    bindDialogActions();
  }

  /* ══════════════════════════════════════════════════════════
     FEATURE RENDERERS
     ══════════════════════════════════════════════════════════ */

  /* ── Mood ─────────────────────────────────────────────── */
  function renderMood() {
    const moods = [
      ["sun",   "🌞", "Vui vẻ",            "Mong niềm vui ấy ở lại thêm một chút. Cậu có thể tận hưởng nó theo cách của mình."],
      ["calm",  "🌷", "Bình yên",           "Thật dễ chịu khi có một khoảng lặng. Cậu cứ ở đây lâu tùy ý nhé."],
      ["tired", "☁️", "Hơi mệt",           "Cậu có thể nghỉ một chút mà không cần thấy áy náy. Mình gửi cậu một góc thật êm."],
      ["sad",   "🌧️","Buồn một chút",     "Không sao đâu, hôm nay cậu không cần phải cố tỏ ra ổn. Mình ở đây để gửi cậu một chút dịu dàng."],
      ["messy", "🌪️","Rối bời",           "Cậu không cần giải quyết tất cả mọi thứ ngay lúc này. Mình thử dừng lại một chút nhé?"],
      ["care",  "🫂", "Muốn được quan tâm", "Cậu xứng đáng được để ý và chăm sóc. Mình gửi cậu một cái ôm thật ấm."]
    ];
    return `<p class="dialog-lead">Chọn cảm xúc gần với cậu nhất lúc này. Không có lựa chọn nào sai, và cậu có thể đổi ý bất cứ khi nào.</p>
      <div class="mood-grid">${moods.map(([id, icon, label]) =>
        `<button class="mood-choice" type="button" data-mood="${id}" data-message="${safeText(label)}">
           <span aria-hidden="true">${icon}</span><small>${label}</small>
         </button>`).join("")}</div>
      <div class="response-box" id="mood-response" hidden>
        <p id="mood-response-text"></p>
        <button class="button button-soft" type="button" data-open="notes">Đọc một lời nhắn nhỏ ↗</button>
        <button class="text-button" type="button" data-mood-reset>Chọn lại</button>
      </div>
      <p class="inline-status">Lựa chọn này không được lưu lại. Website chỉ là một góc nghỉ ngơi, không thay thế hỗ trợ chuyên môn.</p>`;
  }

  /* ── Notes / Letters ─────────────────────────────────── */
  function renderNotes() {
    const categories = [...new Set(config.notes.map((n) => n.category))];
    if (!categories.includes(memoryState.category)) memoryState.category = categories[0];
    return `<p class="dialog-lead">Chọn một chiếc phong thư hoặc để mình rút ngẫu nhiên nhé. Lời nhắn yêu thích được lưu trên thiết bị này.</p>
      <div class="note-categories" role="group" aria-label="Nhóm lời nhắn">
        ${categories.map((cat) =>
          `<button class="pill ${cat === memoryState.category ? "is-selected" : ""}" data-category="${safeText(cat)}" type="button">${safeText(cat)}</button>`
        ).join("")}
      </div>
      <article class="note-paper" aria-live="polite">
        <span class="note-category-label" id="note-category">${safeText(memoryState.category.toLocaleUpperCase("vi-VN"))}</span>
        <p id="note-text">${safeText(pickNote(memoryState.category))}</p>
      </article>
      <div class="dialog-actions">
        <button class="button button-primary" type="button" data-note-next>Một lời nhắn khác</button>
        <button class="button button-soft"    type="button" data-note-favorite>♡ Lưu yêu thích</button>
        <button class="button button-soft"    type="button" data-note-copy>Sao chép</button>
      </div>
      <p class="inline-status" id="note-status" aria-live="polite"></p>
      <div class="soft-card" style="margin-top:14px">
        <strong>Lời nhắn đã lưu</strong>
        <div id="favorite-notes" class="inline-status"></div>
      </div>`;
  }

  function pickNote(category) {
    const candidates = config.notes.filter((n) => n.category === category);
    if (!candidates.length) return config.notes[0].text;
    const available = candidates.filter((n) => n.text !== memoryState.previousNote);
    const pool      = available.length ? available : candidates;
    const picked    = pool[Math.floor(Math.random() * pool.length)];
    memoryState.previousNote = picked.text;
    return picked.text;
  }

  /* ── Hug ─────────────────────────────────────────────── */
  function renderHug() {
    return `<p class="dialog-lead">Chọn cách cậu muốn được vỗ về. Website không tự phát âm thanh hoặc rung thiết bị.</p>
      <div class="hug-stage" id="hug-stage" aria-live="polite">
        <span class="hug-arm left"  aria-hidden="true">🫶</span>
        <span class="hug-heart"     aria-hidden="true">💗</span>
        <span class="hug-arm right" aria-hidden="true">🫶</span>
      </div>
      <p class="hug-message" id="hug-message">Ôm cậu một cái thật lâu. Không cần nói gì cũng được.</p>
      <div class="dialog-actions" style="justify-content:center">
        <button class="button button-primary" type="button" data-hug="Ôm cậu một cái thật lâu. Không cần nói gì cũng được.">Ôm thật lâu</button>
        <button class="button button-soft"    type="button" data-hug="Một cái ôm nhẹ nhàng, vừa đủ để cậu biết mình luôn ở đây.">Ôm nhẹ</button>
        <button class="button button-soft"    type="button" data-hug="Mình gửi cậu một cái ôm kèm lời nhắn: hôm nay cậu đã cố gắng nhiều rồi.">Ôm kèm lời nhắn</button>
        <button class="button button-soft"    type="button" data-hug="Chụt! Một nụ hôn gió bay đến chỗ cậu đây.">Nụ hôn gió 💋</button>
      </div>`;
  }

  /* ── Games ───────────────────────────────────────────── */
  function renderGames() {
    return `<p class="dialog-lead">Chọn trò mình thích. Không cần vội; mục tiêu chỉ là có một khoảnh khắc vui.</p>
      <div class="game-list">
        <button class="game-option" type="button" data-game="catch">
          <span class="game-emoji">💗</span>
          <span><strong>Bắt lấy trái tim</strong><small>Bắt càng nhiều trái tim càng tốt trong 20 giây.</small></span>
        </button>
        <button class="game-option" type="button" data-game="memory">
          <span class="game-emoji">🃏</span>
          <span><strong>Tìm cặp hình giống nhau</strong><small>Lật thẻ và tìm đủ bốn cặp đáng yêu.</small></span>
        </button>
        <button class="game-option" type="button" data-game="garden">
          <span class="game-emoji">🌱</span>
          <span><strong>Chăm sóc khu vườn</strong><small>Tưới cây, đón nắng và gửi lời thương.</small></span>
        </button>
        <button class="game-option" type="button" data-game="quiz">
          <span class="game-emoji">🌈</span>
          <span><strong>Điều gì khiến cậu mỉm cười?</strong><small>Vài lựa chọn nhỏ tạo thành tấm chân dung vui.</small></span>
        </button>
      </div>`;
  }

  /* ── Garden ──────────────────────────────────────────── */
  function renderGarden() {
    const garden = getGarden();
    const growth = Math.min(100, garden.water * 12 + garden.sun * 10 + garden.love * 8);
    const plant  = growth > 75 ? "🌻" : growth > 42 ? "🌿" : growth > 15 ? "🌱" : "🪴";
    return `<p class="dialog-lead">Khu vườn này không cần chăm mỗi ngày đâu. Mỗi lần ghé qua, cậu có thể chọn một điều nho nhỏ.</p>
      <div class="garden-art">
        <span class="garden-plant" id="garden-plant" role="img" aria-label="Chậu cây đang lớn">${plant}</span>
        <span class="garden-sparkles" aria-hidden="true">${"✦ ".repeat(Math.min(garden.stars, 5))}</span>
        <span class="garden-ground"></span>
      </div>
      <div class="garden-progress" role="progressbar" aria-label="Cây đang lớn lên" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${growth}">
        <span style="width:${growth}%"></span>
      </div>
      <p class="inline-status" id="garden-status">Cây đã được cậu chăm sóc ${garden.water + garden.sun + garden.love} lần. Trang trí nhỏ: ${garden.decorations}.</p>
      <div class="dialog-actions">
        <button class="button button-soft" type="button" data-garden="water">💧 Tưới nước</button>
        <button class="button button-soft" type="button" data-garden="sun">☀️ Đón nắng</button>
        <button class="button button-soft" type="button" data-garden="love">💌 Gửi lời thương</button>
        <button class="button button-soft" type="button" data-garden="star">⭐ Nhặt ngôi sao</button>
      </div>
      <div class="dialog-actions">
        <button class="text-button" type="button" data-garden-reset>Đặt lại khu vườn</button>
      </div>`;
  }

  /* ── Memories ─────────────────────────────────────────── */
  function renderMemories() {
    if (!config.memories.length) {
      return `<div class="empty-state"><span>📷</span>Chưa có kỷ niệm nào. Thêm ảnh trong <code>js/data.js</code> nhé.</div>`;
    }
    return `<p class="dialog-lead">Những hình bên dưới là ô minh họa, không phải ảnh thật. Thay bằng ảnh mà hai người đồng ý chia sẻ trong <code>js/data.js</code>.</p>
      <div class="memory-gallery">
        ${config.memories.map((item, index) => `
          <button class="memory-photo" type="button" data-memory-index="${index}" aria-label="Mở kỷ niệm: ${safeText(item.title)}">
            ${item.image
              ? `<img class="photo-art" src="${safeText(item.image)}" alt="" loading="lazy" width="480" height="420" data-fallback="${safeText(item.emoji || "♡")}">`
              : `<span class="photo-art" aria-hidden="true">${safeText(item.emoji || "♡")}</span>`}
            <strong>${safeText(item.title)}</strong>
            <small>${safeText(item.date)} · ${safeText(item.caption)}</small>
          </button>`).join("")}
      </div>`;
  }

  /* ── Music ───────────────────────────────────────────── */
  function renderMusic() {
    if (!config.tracks.length) {
      return `<p class="dialog-lead">Không có âm thanh nào tự động phát. Chỉ những bài do cậu thêm vào cấu hình mới xuất hiện ở đây.</p>
        <div class="empty-state"><span>🎧</span>Chưa có bài hát trong máy nghe nhạc.<br>Thêm tệp âm thanh được phép sử dụng vào <code>assets/audio/</code>, rồi thêm đường dẫn tương đối trong <code>js/data.js</code>.</div>`;
    }
    musicTrackIndex %= config.tracks.length;
    const track = config.tracks[musicTrackIndex];
    return `<p class="dialog-lead">Nhấn phát khi cậu sẵn sàng. Nếu tệp không tải được, trình duyệt sẽ báo ở bên dưới.</p>
      <div class="audio-shell">
        <div class="album-art" aria-hidden="true">♫</div>
        <h3 id="track-title">${safeText(track.title)}</h3>
        <p id="track-artist">${safeText(track.artist || config.sender)}</p>
        ${config.tracks.length > 1
          ? `<div class="dialog-actions" style="justify-content:center">
               <button class="button button-soft" type="button" data-track-step="-1" aria-label="Bài trước">← Trước</button>
               <button class="button button-soft" type="button" data-track-step="1"  aria-label="Bài tiếp theo">Tiếp →</button>
             </div>` : ""}
        <audio controls preload="none" id="audio-player" aria-label="Trình phát nhạc" src="${safeText(track.src)}"></audio>
        <p class="inline-status" id="audio-status" aria-live="polite"></p>
      </div>`;
  }

  /* ── Wishes ──────────────────────────────────────────── */
  function renderWishes() {
    const wishes = storage.get("wishes", []);
    return `<p class="dialog-lead">Một điều ước không cần thành hiện thực ngay để có ý nghĩa. Điều ước chỉ được lưu trên thiết bị này.</p>
      <form class="wish-form" id="wish-form">
        <label class="sr-only" for="wish-input">Điều ước của cậu</label>
        <input class="text-input" id="wish-input" name="wish" maxlength="140" required placeholder="Mình mong rằng...">
        <button class="button button-primary" type="submit">Gửi lên trời ✨</button>
      </form>
      <p class="inline-status">Tối đa 140 ký tự. Dữ liệu ở lại trên trình duyệt hiện tại.</p>
      <div class="wish-list" id="wish-list">
        ${wishes.length
          ? wishes.map((wish, index) => `
              <div class="wish-item">
                <p>⭐ ${safeText(wish)}</p>
                <button class="wish-delete" type="button" data-wish-edit="${index}"   aria-label="Sửa điều ước" title="Sửa">✎</button>
                <button class="wish-delete" type="button" data-wish-delete="${index}" aria-label="Xóa điều ước" title="Xóa">×</button>
              </div>`).join("")
          : `<div class="empty-state"><span>🌟</span>Chưa có điều ước nào. Cậu có thể viết điều đầu tiên.</div>`}
      </div>
      <div class="response-box">Hy vọng sẽ có một ngày thật đẹp đang chờ cậu ở phía trước. 🌙</div>`;
  }

  /* ── Card maker ──────────────────────────────────────── */
  function renderCard() {
    return `<p class="dialog-lead">Tạo tấm thiệp để tải xuống, sao chép lời nhắn hoặc chia sẻ khi trình duyệt hỗ trợ.</p>
      <div class="card-preview" id="card-preview">
        <div>
          <span id="card-emoji">💗</span>
          <div id="card-text">Gửi cậu một chút dịu dàng hôm nay.</div>
          <small>— ${safeText(config.sender)}</small>
        </div>
      </div>
      <div class="card-controls">
        <div>
          <label class="input-label" for="card-theme">Phong cách</label>
          <select class="select-input" id="card-theme">
            <option value="pastel">Pastel</option>
            <option value="sky">Bầu trời đêm</option>
            <option value="garden">Khu vườn</option>
            <option value="heart">Trái tim</option>
          </select>
        </div>
        <div>
          <label class="input-label" for="card-sticker">Sticker</label>
          <select class="select-input" id="card-sticker">
            <option>💗</option><option>🌷</option><option>🌙</option>
            <option>☁️</option><option>🐈</option><option>⭐</option>
          </select>
        </div>
        <div class="full-width">
          <label class="input-label" for="card-message">Lời nhắn (tối đa 180 ký tự)</label>
          <textarea class="text-area" id="card-message" maxlength="180">Gửi cậu một chút dịu dàng hôm nay.</textarea>
        </div>
      </div>
      <div class="dialog-actions">
        <button class="button button-primary" type="button" data-card-download>Tải thiệp PNG</button>
        <button class="button button-soft"    type="button" data-card-copy>Sao chép lời nhắn</button>
        <button class="button button-soft"    type="button" data-card-share>Chia sẻ</button>
      </div>
      <p class="inline-status" id="card-status" aria-live="polite"></p>`;
  }

  /* ── Gifts ───────────────────────────────────────────── */
  function renderGifts() {
    const labels = Object.keys(config.gifts);
    return `<p class="dialog-lead">Mỗi chiếc hộp giấu một câu nhắn hoặc một món quà nhỏ có thể đổi lấy khi hai người muốn.</p>
      <div class="gift-grid">
        ${labels.map((label) =>
          `<button class="gift-box" type="button" data-gift="${safeText(label)}">
             <span aria-hidden="true">🎁</span>${safeText(label)}
           </button>`).join("")}
      </div>
      <div class="gift-reveal" id="gift-reveal" aria-live="polite">Chọn một chiếc hộp nhé ✨</div>`;
  }

  /* ── Settings ─────────────────────────────────────────── */
  function renderSettings() {
    const settings = storage.get("settings", { decoration: true, sound: false });
    return `<p class="dialog-lead">Mặc định âm thanh tắt. Hiệu ứng trang trí có thể bật/tắt tùy ý.</p>
      <div class="settings-list">
        <label class="setting-row">
          <span><strong>Hiệu ứng trang trí</strong><small>Chuyển động nhẹ và hạt lấp lánh.</small></span>
          <input type="checkbox" data-setting="decoration" ${settings.decoration ? "checked" : ""}>
        </label>
        <label class="setting-row">
          <span><strong>Âm thanh tương tác</strong><small>Hiện chưa có hiệu ứng âm thanh để phát.</small></span>
          <input type="checkbox" data-setting="sound" ${settings.sound ? "checked" : ""} disabled>
        </label>
      </div>
      <p class="inline-status">Tên, nội dung, ảnh và danh sách nhạc có thể sửa trong <code>js/data.js</code>.</p>`;
  }

  /* ══════════════════════════════════════════════════════════
     DIALOG ACTION BINDERS
     ══════════════════════════════════════════════════════════ */
  function bindDialogActions() {
    const noteText = $("#note-text");
    if (noteText) updateFavoriteStatus();
    const audio = $("#audio-player");
    if (audio) {
      audio.addEventListener("error", () => {
        const s = $("#audio-status");
        if (s) s.textContent = "Không thể phát tệp này. Kiểm tra đường dẫn tương đối và định dạng âm thanh.";
      });
    }
  }

  function updateFavoriteStatus() {
    const target    = $("#favorite-notes");
    if (!target) return;
    const favorites = storage.get("favoriteNotes", []);
    if (!favorites.length) { target.textContent = "Chưa lưu lời nhắn nào."; return; }
    target.innerHTML = `<ul style="margin:.6em 0 0;padding-left:1.2em">${favorites.map((note, i) =>
      `<li style="margin-bottom:.4em">${safeText(note)} <button class="text-button" type="button" data-favorite-remove="${i}" aria-label="Bỏ yêu thích lời nhắn ${i+1}">Bỏ lưu</button></li>`
    ).join("")}</ul>`;
  }

  function changeNoteCategory(category) {
    memoryState.category = category;
    const noteText = $("#note-text");
    if (!noteText) return;
    noteText.style.opacity = "0";
    noteText.style.transform = "translateY(8px)";
    window.setTimeout(() => {
      noteText.textContent = pickNote(category);
      $("#note-category").textContent = category.toLocaleUpperCase("vi-VN");
      noteText.style.transition = "opacity .3s, transform .3s";
      noteText.style.opacity = "";
      noteText.style.transform = "";
    }, 160);
    $$(".note-categories .pill").forEach((btn) =>
      btn.classList.toggle("is-selected", btn.dataset.category === category));
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Đã sao chép vào bộ nhớ tạm.");
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.style.cssText = "position:fixed;opacity:0";
      document.body.append(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      if (copied) toast("Đã sao chép vào bộ nhớ tạm.");
      else toast("Không thể sao chép tự động trên trình duyệt này.");
    }
  }

  /* ══════════════════════════════════════════════════════════
     GAMES
     ══════════════════════════════════════════════════════════ */

  /* ── Catch game ──────────────────────────────────────── */
  function startCatchGame() {
    const duration = 20;
    let score = 0, seconds = duration;
    showDialog("Bắt lấy trái tim", "TRÒ CHƠI NHỎ",
      `<p class="dialog-lead">Chạm vào trái tim trong khu vườn để bắt lấy nhé!</p>
       <div class="game-board" id="catch-board">
         <div class="game-stats">
           <span>Điểm: <b id="catch-score">0</b></span>
           <span>Còn lại: <b id="catch-time">${duration}</b>s</span>
         </div>
         <button class="catch-target" id="catch-target" type="button" aria-label="Bắt trái tim">💗</button>
         <div id="catch-result" class="response-box" hidden></div>
       </div>
       <div class="dialog-actions">
         <button class="button button-primary" type="button" data-catch-restart>Chơi lại</button>
         <button class="button button-soft"    type="button" data-game-menu>Chọn trò khác</button>
       </div>`);

    const target  = $("#catch-target");
    const moveTarget = () => {
      target.style.left = `${8  + Math.random() * 76}%`;
      target.style.top  = `${28 + Math.random() * 52}%`;
    };
    const catchHeart = () => {
      if (seconds <= 0) return;
      score += 1;
      $("#catch-score").textContent = String(score);
      burst(target, "♡");
      moveTarget();
    };
    target.addEventListener("click", catchHeart);
    gameCleanup.push(() => target.removeEventListener("click", catchHeart));
    moveTarget();

    catchTimer = window.setInterval(() => {
      seconds -= 1;
      const timeEl = $("#catch-time");
      if (timeEl) {
        timeEl.textContent = String(seconds);
        // Urgency pulse when ≤5s
        timeEl.classList.toggle("is-urgent", seconds <= 5 && seconds > 0);
      }
      if (seconds <= 0) {
        window.clearInterval(catchTimer);
        if (target) target.hidden = true;
        const result = $("#catch-result");
        if (result) {
          result.hidden = false;
          result.textContent = `Cậu đã bắt được ${score} trái tim 🎉 Cảm ơn cậu đã chơi cùng mình!`;
          burst(result, "✦");
        }
        const g = getGarden();
        storage.set("garden", { ...g, decorations: (g.decorations || 0) + 1 });
      }
    }, 1000);
  }

  /* ── Memory game ─────────────────────────────────────── */
  function startMemoryGame() {
    const symbols = ["💗", "🌷", "🐈", "⭐", "☁️", "🍓", "🦋", "🌙"];
    const deck    = [...symbols.slice(0, 4), ...symbols.slice(0, 4)].sort(() => Math.random() - .5);
    let opened = [], matched = 0, moves = 0;

    showDialog("Tìm những cặp giống nhau", "TRÒ CHƠI NHỎ",
      `<p class="dialog-lead">Lật hai tấm thẻ một lượt để tìm đủ bốn cặp nhé.</p>
       <div class="game-stats">
         <span>Lượt lật: <b id="memory-moves">0</b></span>
         <span>Đã tìm: <b id="memory-matched">0</b>/4</span>
       </div>
       <div class="memory-grid" id="memory-grid">
         ${deck.map((sym, i) =>
           `<button class="memory-card" type="button" data-card-index="${i}" aria-label="Thẻ úp">?</button>`
         ).join("")}
       </div>
       <div class="response-box" id="memory-result" hidden>Giỏi quá, cậu đã tìm đủ các cặp rồi! 🎉</div>
       <div class="dialog-actions">
         <button class="button button-primary" type="button" data-game="memory">Chơi lại</button>
         <button class="button button-soft"    type="button" data-game-menu>Chọn trò khác</button>
       </div>`);

    $$(".memory-card", dialogContent).forEach((card) => {
      card.addEventListener("click", () => {
        const idx = Number(card.dataset.cardIndex);
        if (opened.length >= 2 || card.classList.contains("is-open") || card.classList.contains("is-matched")) return;
        card.textContent = deck[idx];
        card.classList.add("is-open");
        card.setAttribute("aria-label", `Thẻ ${deck[idx]}`);
        opened.push({ card, symbol: deck[idx] });

        if (opened.length === 2) {
          moves += 1;
          const movesEl = $("#memory-moves");
          if (movesEl) movesEl.textContent = String(moves);

          if (opened[0].symbol === opened[1].symbol) {
            opened.forEach(({ card: c }) => c.classList.add("is-matched"));
            matched += 1;
            const matchEl = $("#memory-matched");
            if (matchEl) matchEl.textContent = String(matched);
            opened = [];
            if (matched === 4) {
              const result = $("#memory-result");
              if (result) { result.hidden = false; burst(result, "✦"); }
              const g = getGarden();
              storage.set("garden", { ...g, decorations: (g.decorations || 0) + 1 });
            }
          } else {
            const pair = opened;
            memoryTimer = window.setTimeout(() => {
              pair.forEach(({ card: c }) => {
                c.classList.remove("is-open");
                c.textContent = "?";
                c.setAttribute("aria-label", "Thẻ úp");
              });
              opened = [];
            }, 800);
          }
        }
      });
    });
  }

  /* ── Garden game ─────────────────────────────────────── */
  function startGardenGame() {
    showDialog("Chăm sóc khu vườn", "TRÒ CHƠI NHỎ",
      `<p class="dialog-lead">Chọn điều cây cần. Không có đồng hồ và cây không héo nếu cậu rời đi.</p>
       <div class="garden-art">
         <span class="garden-plant" id="game-plant">🪴</span>
         <span class="garden-ground"></span>
       </div>
       <p class="inline-status" id="plant-status">Cây đang chờ một chút quan tâm của cậu.</p>
       <div class="dialog-actions">
         <button class="button button-soft" type="button" data-plant="water">💧 Tưới nước</button>
         <button class="button button-soft" type="button" data-plant="sun">☀️ Đón nắng</button>
         <button class="button button-soft" type="button" data-plant="love">💌 Gửi lời thương</button>
       </div>
       <div class="dialog-actions">
         <button class="button button-soft" type="button" data-game-menu>Chọn trò khác</button>
       </div>`);

    const plant   = $("#game-plant");
    const status  = $("#plant-status");
    const msgs    = {
      water : "Cây đã uống nước, trông tươi tắn hơn rồi. 💧",
      sun   : "Một chút nắng ấm vừa ghé qua khu vườn. ☀️",
      love  : "Cây nghe được lời thương và khẽ rung rinh. 💌"
    };
    $$("[data-plant]", dialogContent).forEach((btn) => {
      btn.addEventListener("click", () => {
        const key    = btn.dataset.plant;
        const garden = getGarden();
        garden[key]  = (garden[key] || 0) + 1;
        storage.set("garden", garden);
        const total  = garden.water + garden.sun + garden.love;
        plant.textContent = total > 7 ? "🌻" : total > 3 ? "🌿" : "🌱";
        plant.classList.add("is-growing");
        if (status) status.textContent = msgs[key] || "";
        burst(plant, "✦");
        window.setTimeout(() => plant?.classList.remove("is-growing"), 400);
      });
    });
  }

  /* ── Quiz ─────────────────────────────────────────────── */
  const quizQuestions = [
    { prompt: "Một buổi thư giãn hợp với cậu nhất là…", options: ["Ngắm mưa bên cửa sổ 🌧️", "Đi dạo lúc hoàng hôn 🌇", "Ở nhà cùng đồ ăn ngon 🍓"] },
    { prompt: "Nếu có một bạn nhỏ đi cùng, cậu chọn…", options: ["Mèo cuộn tròn 🐈", "Thỏ tai mềm 🐇", "Một chú chim líu lo 🐦"] },
    { prompt: "Chút vui hôm nay sẽ là…", options: ["Một bài hát 🎵", "Một món ngọt 🍰", "Một giấc ngủ ngon 🌙"] }
  ];

  function startQuiz() {
    let step = 0;
    const answers = [];
    const renderQuestion = () => {
      const q = quizQuestions[step];
      showDialog("Điều gì khiến cậu mỉm cười?", "TRÒ CHƠI NHỎ",
        `<p class="dialog-lead">Câu ${step + 1} / ${quizQuestions.length} · Không có đáp án đúng sai.</p>
         <h3>${q.prompt}</h3>
         <div class="quiz-options">
           ${q.options.map((opt, i) =>
             `<button class="quiz-choice" type="button" data-answer="${i}">${opt}</button>`).join("")}
         </div>
         <div class="dialog-actions">
           <button class="button button-soft" type="button" data-game-menu>Thoát trò chơi</button>
         </div>`);
      $$("[data-answer]", dialogContent).forEach((btn) => {
        btn.addEventListener("click", () => {
          answers.push(q.options[Number(btn.dataset.answer)]);
          step += 1;
          if (step < quizQuestions.length) renderQuestion();
          else showQuizResult(answers);
        });
      });
    };
    renderQuestion();
  }

  function showQuizResult(answers) {
    const text = `Tấm chân dung vui của cậu: ${answers.join(" · ")}. Mong những điều nhỏ này ghé thăm cậu thật sớm!`;
    showDialog("Một tấm chân dung thật riêng", "TRÒ CHƠI NHỎ",
      `<div class="response-box">${safeText(text)}</div>
       <div class="dialog-actions">
         <button class="button button-primary" type="button" data-quiz-share>Chia sẻ kết quả</button>
         <button class="button button-soft"    type="button" data-game="quiz">Chơi lại</button>
         <button class="button button-soft"    type="button" data-game-menu>Chọn trò khác</button>
       </div>
       <p class="inline-status" id="quiz-status" aria-live="polite"></p>`);
  }

  /* ── Memory lightbox ─────────────────────────────────── */
  function renderMemoryLightbox(index) {
    const item = config.memories[index];
    if (!item) return;
    memoryState.memoryIndex = index;

    const overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", item.title);
    overlay.innerHTML = `
      <div class="lightbox-content">
        <button class="icon-button lightbox-close" type="button" aria-label="Đóng ảnh" style="margin:0 0 14px auto;display:flex">×</button>
        <div class="lightbox-art" aria-hidden="true">
          ${item.image
            ? `<img src="${safeText(item.image)}" alt="" data-fallback="${safeText(item.emoji || "♡")}">`
            : safeText(item.emoji || "♡")}
        </div>
        <h3>${safeText(item.title)}</h3>
        <p class="lightbox-caption">${safeText(item.date)} · ${safeText(item.caption)}</p>
        <div class="lightbox-controls">
          <button class="button button-soft" type="button" data-memory-prev>← Trước</button>
          <button class="button button-soft" type="button" data-memory-next>Tiếp →</button>
        </div>
      </div>`;

    dialogContent.append(overlay);

    const close  = () => { overlay.remove(); document.removeEventListener("keydown", escape); };
    const escape = (e)  => { if (e.key === "Escape") close(); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    $(".lightbox-close", overlay).addEventListener("click", close);
    $("[data-memory-prev]", overlay).addEventListener("click", () => {
      close(); renderMemoryLightbox((index - 1 + config.memories.length) % config.memories.length);
    });
    $("[data-memory-next]", overlay).addEventListener("click", () => {
      close(); renderMemoryLightbox((index + 1) % config.memories.length);
    });
    document.addEventListener("keydown", escape);
  }

  /* ── Card theme ──────────────────────────────────────── */
  function applyCardTheme(theme) {
    const preview = $("#card-preview");
    if (!preview) return;
    const themes = {
      pastel  : ["linear-gradient(140deg,#ffe2e9,#f2eaff)",   "#493848"],
      sky     : ["linear-gradient(140deg,#313b67,#7966a4)",   "#fffaf3"],
      garden  : ["linear-gradient(140deg,#dff1df,#fff0cf)",   "#344d3e"],
      heart   : ["linear-gradient(140deg,#ffb9c8,#f7d7e6)",   "#653b50"]
    };
    currentCardTheme = theme;
    preview.style.background = themes[theme][0];
    preview.style.color      = themes[theme][1];
  }

  function drawCardPng(message) {
    const canvas  = document.createElement("canvas");
    const W = 1000, H = 700;
    const ctx     = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas không khả dụng.");
    canvas.width  = W; canvas.height = H;
    const themes  = {
      pastel  : ["#ffe2e9", "#f2eaff", "#493848"],
      sky     : ["#313b67", "#7966a4", "#fffaf3"],
      garden  : ["#dff1df", "#fff0cf", "#344d3e"],
      heart   : ["#ffb9c8", "#f7d7e6", "#653b50"]
    };
    const [c1, c2, ink] = themes[currentCardTheme];
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.38)";
    ctx.beginPath(); ctx.roundRect(32, 32, W - 64, H - 64, 36); ctx.fill();
    ctx.textAlign = "center"; ctx.fillStyle = ink;
    ctx.font = "68px 'Be Vietnam Pro',sans-serif";
    ctx.fillText(currentCardEmoji, W / 2, 210);
    ctx.font = "42px 'Be Vietnam Pro',sans-serif";
    const words = message.trim().split(/\s+/);
    const lines = []; let line = "";
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > 780 && line) { lines.push(line); line = word; }
      else line = next;
    });
    if (line) lines.push(line);
    const shown  = lines.slice(0, 4);
    const startY = 330 - (shown.length - 1) * 28;
    shown.forEach((row, i) => ctx.fillText(row, W / 2, startY + i * 60));
    ctx.font = "28px 'Be Vietnam Pro',sans-serif";
    ctx.fillText(`— ${config.sender}`, W / 2, 580);
    return new Promise((res, rej) =>
      canvas.toBlob((blob) => blob ? res(blob) : rej(new Error("Không thể tạo tệp PNG.")), "image/png")
    );
  }

  /* ══════════════════════════════════════════════════════════
     GLOBAL EVENT DELEGATION
     ══════════════════════════════════════════════════════════ */
  function bindGlobalEvents() {
    document.addEventListener("click", async (event) => {
      /* ── Open feature ── */
      const trigger = event.target.closest("[data-open]");
      if (trigger) { openFeature(trigger.dataset.open); return; }

      /* ── Note category pill ── */
      const category = event.target.closest("[data-category]");
      if (category) { changeNoteCategory(category.dataset.category); return; }

      /* ── Mood choice ── */
      const mood = event.target.closest("[data-mood]");
      if (mood) {
        const rText = $("#mood-response-text");
        const rBox  = $("#mood-response");
        if (rText) rText.textContent = mood.dataset.message;
        if (rBox)  { rBox.hidden = false; rBox.style.animation = "none"; rBox.offsetHeight; rBox.style.animation = ""; }
        // Visual selected state on mood buttons
        $$(".mood-choice").forEach((m) => m.classList.remove("is-chosen"));
        mood.classList.add("is-chosen");
        const expr = { sun: "^ᴗ^", calm: "˘ᴗ˘", tired: "ᴗ̀_ᴗ́", sad: "ᴗ́︿ᴗ̀", messy: "°ロ°", care: "ᵕᴗᵕ" };
        const face   = $(".mascot-face");
        const mascot = $("#mascot");
        if (face) face.textContent = expr[mood.dataset.mood] || "ᵔᴗᵔ";
        if (mascot) {
          mascot.setAttribute("aria-label", `Mascot đang đồng cảm với cảm xúc: ${mood.dataset.message}`);
          mascot.classList.add("is-reacting");
          window.setTimeout(() => mascot?.classList.remove("is-reacting"), 500);
        }
        return;
      }
      if (event.target.closest("[data-mood-reset]")) { const r = $("#mood-response"); if (r) r.hidden = true; return; }

      /* ── Hug button ── */
      const hug = event.target.closest("[data-hug]");
      if (hug) {
        const msg   = $("#hug-message");
        const stage = $("#hug-stage");
        if (msg)   msg.textContent = hug.dataset.hug;
        if (stage) {
          stage.classList.add("is-hugging");
          burst(stage, "♡");
          window.setTimeout(() => stage?.classList.remove("is-hugging"), 1100);
        }
        return;
      }

      /* ── Note: next ── */
      if (event.target.closest("[data-note-next]")) {
        const nt = $("#note-text");
        if (nt) {
          nt.style.transition = "opacity .18s, transform .18s";
          nt.style.opacity    = "0";
          nt.style.transform  = "translateY(6px)";
          window.setTimeout(() => {
            nt.textContent  = pickNote(memoryState.category);
            nt.style.opacity = "";
            nt.style.transform = "";
          }, 190);
        }
        const ns = $("#note-status");
        if (ns) ns.textContent = "";
        return;
      }

      /* ── Note: favourite ── */
      if (event.target.closest("[data-note-favorite]")) {
        const text      = $("#note-text")?.textContent || "";
        const favorites = storage.get("favoriteNotes", []);
        if (favorites.includes(text)) toast("Lời nhắn này đã nằm trong mục yêu thích rồi.");
        else { favorites.push(text); storage.set("favoriteNotes", favorites); toast("Đã lưu lời nhắn yêu thích. ♡"); }
        updateFavoriteStatus();
        return;
      }

      /* ── Note: copy ── */
      if (event.target.closest("[data-note-copy]")) {
        await copyText($("#note-text")?.textContent || ""); return;
      }

      /* ── Favourite remove ── */
      const favRm = event.target.closest("[data-favorite-remove]");
      if (favRm) {
        const favorites = storage.get("favoriteNotes", []);
        favorites.splice(Number(favRm.dataset.favoriteRemove), 1);
        storage.set("favoriteNotes", favorites);
        updateFavoriteStatus();
        toast("Đã bỏ lời nhắn khỏi mục yêu thích.");
        return;
      }

      /* ── Track step ── */
      const trackStep = event.target.closest("[data-track-step]");
      if (trackStep) {
        musicTrackIndex = (musicTrackIndex + Number(trackStep.dataset.trackStep) + config.tracks.length) % config.tracks.length;
        const track = config.tracks[musicTrackIndex];
        const audio = $("#audio-player");
        if (audio) { audio.pause(); audio.src = track.src; audio.load(); }
        const tt = $("#track-title");  if (tt) tt.textContent = track.title;
        const ta = $("#track-artist"); if (ta) ta.textContent = track.artist || config.sender;
        const as = $("#audio-status"); if (as) as.textContent = "";
        return;
      }

      /* ── Start game ── */
      const game = event.target.closest("[data-game]");
      if (game) {
        const games = { catch: startCatchGame, memory: startMemoryGame, garden: startGardenGame, quiz: startQuiz };
        games[game.dataset.game]?.();
        return;
      }
      if (event.target.closest("[data-game-menu]"))    { openFeature("games"); return; }
      if (event.target.closest("[data-catch-restart]")) { startCatchGame(); return; }

      /* ── Garden actions ── */
      const gardenBtn = event.target.closest("[data-garden]");
      if (gardenBtn) {
        const action = gardenBtn.dataset.garden;
        const garden = getGarden();
        if (action === "star") { garden.stars += 1; garden.decorations += 1; }
        else garden[action] = (garden[action] || 0) + 1;
        storage.set("garden", garden);
        burst(gardenBtn, action === "star" ? "⭐" : "✦");
        openFeature("garden");
        toast(action === "star" ? "Một ngôi sao đã được thêm vào khu vườn." : "Khu vườn đã nhận được một chút dịu dàng.");
        return;
      }
      if (event.target.closest("[data-garden-reset]")) {
        storage.set("garden", { water: 0, sun: 0, love: 0, flower: false, stars: 0, decorations: 0 });
        openFeature("garden");
        toast("Khu vườn đã được đặt lại.");
        return;
      }

      /* ── Memory lightbox ── */
      const memBtn = event.target.closest("[data-memory-index]");
      if (memBtn) { renderMemoryLightbox(Number(memBtn.dataset.memoryIndex)); return; }

      /* ── Gift box ── */
      const gift = event.target.closest("[data-gift]");
      if (gift) {
        const opts   = config.gifts[gift.dataset.gift];
        const reveal = $("#gift-reveal");
        if (reveal && opts) {
          const item = opts[Math.floor(Math.random() * opts.length)];
          reveal.style.opacity   = "0";
          reveal.style.transform = "scale(.97)";
          window.setTimeout(() => {
            reveal.textContent    = item;
            reveal.style.transition = "opacity .3s, transform .3s";
            reveal.style.opacity  = "";
            reveal.style.transform = "";
          }, 200);
          burst(gift, "✦");
        }
        return;
      }

      /* ── Wish: delete ── */
      const wishDel = event.target.closest("[data-wish-delete]");
      if (wishDel) {
        const wishes = storage.get("wishes", []);
        wishes.splice(Number(wishDel.dataset.wishDelete), 1);
        storage.set("wishes", wishes);
        openFeature("wishes");
        toast("Đã xóa điều ước.");
        return;
      }

      /* ── Wish: edit ── */
      const wishEdit = event.target.closest("[data-wish-edit]");
      if (wishEdit) {
        const idx    = Number(wishEdit.dataset.wishEdit);
        const wishes = storage.get("wishes", []);
        const inp    = $("#wish-input");
        const form   = $("#wish-form");
        if (inp) inp.value = wishes[idx] || "";
        if (form) { form.dataset.editingIndex = String(idx); form.querySelector('button[type="submit"]').textContent = "Lưu chỉnh sửa"; }
        if (inp) inp.focus();
        return;
      }

      /* ── Setting checkbox ── */
      const setting = event.target.closest("[data-setting]");
      if (setting) {
        const settings = storage.get("settings", { decoration: true, sound: false });
        settings[setting.dataset.setting] = setting.checked;
        storage.set("settings", settings);
        document.body.classList.toggle("decorations-off", !settings.decoration);
        return;
      }

      /* ── Card theme (click fallback) ── */
      const ct = event.target.closest("#card-theme");
      if (ct) { applyCardTheme(ct.value); return; }
      const cs = event.target.closest("#card-sticker");
      if (cs) { currentCardEmoji = cs.value; const ce = $("#card-emoji"); if (ce) ce.textContent = currentCardEmoji; return; }

      /* ── Card: download ── */
      if (event.target.closest("[data-card-download]")) {
        try {
          const blob = await drawCardPng($("#card-message")?.value || "Gửi cậu một chút dịu dàng hôm nay.");
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = "dieu-diu-dang-danh-cho-cau.png";
          link.click();
          URL.revokeObjectURL(link.href);
          toast("Tấm thiệp PNG đã được tải xuống.");
        } catch (err) {
          const s = $("#card-status"); if (s) s.textContent = `Không thể tạo thiệp: ${err.message}`;
        }
        return;
      }

      /* ── Card: copy ── */
      if (event.target.closest("[data-card-copy]")) {
        await copyText($("#card-message")?.value || ""); return;
      }

      /* ── Card: share ── */
      if (event.target.closest("[data-card-share]")) {
        try {
          const blob = await drawCardPng($("#card-message")?.value || "Gửi cậu một chút dịu dàng hôm nay.");
          const file = new File([blob], "thiep-nho.png", { type: "image/png" });
          if (navigator.canShare?.({ files: [file] }) && navigator.share) {
            await navigator.share({ files: [file], title: "Một tấm thiệp nhỏ", text: $("#card-message")?.value });
          } else if (navigator.share) {
            await navigator.share({ title: "Một tấm thiệp nhỏ", text: $("#card-message")?.value });
          } else {
            await copyText($("#card-message")?.value || "");
            const s = $("#card-status"); if (s) s.textContent = "Trình duyệt chưa hỗ trợ chia sẻ; lời nhắn đã được sao chép.";
          }
        } catch (err) {
          if (err.name !== "AbortError") {
            const s = $("#card-status"); if (s) s.textContent = "Không thể chia sẻ lúc này. Cậu có thể tải PNG hoặc sao chép lời nhắn.";
          }
        }
        return;
      }

      /* ── Quiz: share ── */
      if (event.target.closest("[data-quiz-share]")) {
        const result = $(".response-box", dialogContent)?.textContent || "";
        if (navigator.share) {
          try { await navigator.share({ title: "Chân dung vui của mình", text: result }); }
          catch (err) { if (err.name !== "AbortError") toast("Không thể chia sẻ lúc này."); }
        } else await copyText(result);
      }
    });

    /* ── Dialog backdrop / close button ── */
    dialog.addEventListener("click", (event) => {
      if (event.target.closest(".dialog-close")) closeDialog();
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener("close", cleanupGame);

    /* ── Welcome screen buttons ── */
    $("#open-gift").addEventListener("click", () => {
      burst($(".envelope-art"), "♡");
      startExperience();
      window.setTimeout(() => openFeature("notes"), 500);
    });
    $("#skip-welcome").addEventListener("click", startExperience);

    /* ── Dialog: live card preview ── */
    dialogContent.addEventListener("input", (event) => {
      if (event.target.id === "card-message") {
        const ct2 = $("#card-text");
        if (ct2) ct2.textContent = event.target.value || " ";
      }
    });

    /* ── Dialog: image error fallback ── */
    dialogContent.addEventListener("error", (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.fallback) return;
      const fb = document.createElement("span");
      fb.className = img.className;
      fb.setAttribute("aria-hidden", "true");
      fb.textContent = img.dataset.fallback;
      img.replaceWith(fb);
    }, true);

    /* ── Dialog: change (select) ── */
    dialogContent.addEventListener("change", (event) => {
      if (event.target.id === "card-theme")   applyCardTheme(event.target.value);
      if (event.target.id === "card-sticker") {
        currentCardEmoji = event.target.value;
        const ce = $("#card-emoji"); if (ce) ce.textContent = currentCardEmoji;
      }
    });

    /* ── Dialog: wish form submit ── */
    dialogContent.addEventListener("submit", (event) => {
      if (event.target.id !== "wish-form") return;
      event.preventDefault();
      const field = $("#wish-input");
      const wish  = field?.value.trim() || "";
      if (!wish || wish.length > 140) return;
      const wishes       = storage.get("wishes", []);
      const editingIndex = event.target.dataset.editingIndex;
      if (editingIndex === undefined) wishes.unshift(wish);
      else wishes[Number(editingIndex)] = wish;
      storage.set("wishes", wishes.slice(0, 50));
      openFeature("wishes");
      toast(editingIndex === undefined ? "Điều ước của cậu đã được gửi lên trời. ⭐" : "Điều ước đã được cập nhật.");
      burst(dialogContent, "✦");
    });

    /* ── Sticky header scroll shadow ── */
    const header = $("#site-header");
    if (header && "IntersectionObserver" in window) {
      const sentinel = document.createElement("div");
      sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none";
      document.body.prepend(sentinel);
      new IntersectionObserver(([entry]) => {
        header.classList.toggle("is-scrolled", !entry.isIntersecting);
      }, { threshold: 0 }).observe(sentinel);
    }

    /* ── Escape key closes dialog ── */
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && dialog.open) closeDialog();
    });
  }

  /* ══════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════ */
  /* ── Scroll-reveal IntersectionObserver ────────────────── */
  function initScrollReveal() {
    if (!('IntersectionObserver' in window)) return;
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });

    // Stagger feature cards
    $$('.feature-card, .lower-grid > *').forEach((el, i) => {
      el.style.transitionDelay = `${.06 + i * .08}s`;
      revealObs.observe(el);
    });

    // Hero, sections, footer
    $$('.hero, .section-block, .site-footer').forEach((el) => {
      el.classList.add('reveal');
      revealObs.observe(el);
    });
  }

  /* ── Button ripple on click ─────────────────────────────── */
  function initRipple() {
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.button');
      if (!btn) return;
      const rect   = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'button-ripple';
      ripple.style.left = `${e.clientX - rect.left - 4}px`;
      ripple.style.top  = `${e.clientY - rect.top  - 4}px`;
      btn.append(ripple);
      window.setTimeout(() => ripple.remove(), 600);
    }, { passive: true });
  }

  /* ── Album art spin when audio plays/pauses ─────────────── */
  function bindAlbumArtSpin() {
    dialogContent.addEventListener('play',  () => { $('.album-art')?.classList.add('is-playing');    }, true);
    dialogContent.addEventListener('pause', () => { $('.album-art')?.classList.remove('is-playing'); }, true);
    dialogContent.addEventListener('ended', () => { $('.album-art')?.classList.remove('is-playing'); }, true);
  }

  /* ── Mood: add selected class, mascot reaction ──────────── */
  // (handled inside bindGlobalEvents via event delegation — patching mood handler)
  const _origBindGlobal = bindGlobalEvents;

  function initialize() {
    greeting();
    const settings = storage.get("settings", { decoration: true, sound: false });
    document.body.classList.toggle("decorations-off", !settings.decoration);
    bindGlobalEvents();
    bindAlbumArtSpin();
    initRipple();
    // Defer scroll-reveal until app shell is shown
    const appShell = $('#app-shell');
    if (appShell && !appShell.hidden) {
      initScrollReveal();
    } else {
      // Watch for app-shell becoming visible
      const shellObs = new MutationObserver(() => {
        if (appShell && !appShell.hidden) {
          shellObs.disconnect();
          window.setTimeout(initScrollReveal, 100);
        }
      });
      if (appShell) shellObs.observe(appShell, { attributes: true, attributeFilter: ['hidden'] });
    }
  }

  initialize();
})();
