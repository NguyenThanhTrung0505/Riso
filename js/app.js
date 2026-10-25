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

  function toast(message) {
    const region = $("#toast-region");
    if (!region) return;
    const item = document.createElement("div");
    item.className = "toast";
    item.textContent = message;
    region.append(item);
    window.setTimeout(() => item.remove(), 2800);
  }

  function burst(target = document.body, icon = "✦") {
    const rect = target instanceof Element ? target.getBoundingClientRect() : null;
    for (let index = 0; index < 7; index += 1) {
      const particle = document.createElement("span");
      particle.className = "sparkle-burst";
      particle.textContent = icon;
      particle.style.left = `${(rect ? rect.left + rect.width / 2 : innerWidth / 2) + (Math.random() - .5) * 90}px`;
      particle.style.top = `${(rect ? rect.top + rect.height / 2 : innerHeight / 2) + (Math.random() - .5) * 35}px`;
      particle.style.color = ["#e76f8d", "#c19fe0", "#e7b748"][index % 3];
      document.body.append(particle);
      window.setTimeout(() => particle.remove(), 1050);
    }
  }

  function safeText(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function cleanupGame() {
    gameCleanup.forEach((cleanup) => cleanup());
    gameCleanup = [];
    window.clearInterval(catchTimer);
    window.clearTimeout(memoryTimer);
  }

  function getGarden() {
    return {
      water: 0,
      sun: 0,
      love: 0,
      flower: false,
      stars: 0,
      decorations: 0,
      ...storage.get("garden", {})
    };
  }

  function showDialog(title, kicker, markup) {
    cleanupGame();
    dialogKicker.textContent = kicker;
    dialogContent.innerHTML = `<h2 id="dialog-title">${title}</h2>${markup}`;
    if (!dialog.open) dialog.showModal();
    dialogContent.scrollTop = 0;
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

  function greeting() {
    const hour = new Date().getHours();
    const salutation = hour < 11 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
    $("#greeting-title").innerHTML = `${salutation}, <span data-recipient>${safeText(config.recipient)}</span> <span aria-hidden="true">🌷</span>`;
    $$("[data-recipient]").forEach((node) => { node.textContent = config.recipient; });
    const now = new Date();
    $("#today-label").textContent = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long" }).format(now).toLocaleUpperCase("vi-VN");
    const daySeed = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
    $("#daily-quote").textContent = config.quotes[daySeed % config.quotes.length];
    $("#welcome-copy").textContent = config.openingMessage;
    $("#welcome-signature").textContent = `Gửi cậu, từ ${config.sender} ♡`;
  }

  function startExperience() {
    $("#welcome-screen").hidden = true;
    $("#app-shell").hidden = false;
    $("#bottom-nav").hidden = false;
    greeting();
  }

  const featureTitles = {
    mood: ["Trái tim cậu hôm nay đang ở đâu nhỉ?", "MỘT CHÚT LẮNG NGHE"],
    notes: ["Một chiếc thư dành cho cậu", "HỘP THƯ YÊU THƯƠNG"],
    hug: ["Gửi cậu một cái ôm", "NÚT ÔM KHẨN CẤP"],
    games: ["Chơi một chút nhé", "GÓC TRÒ CHƠI NHỎ"],
    garden: ["Khu vườn của cậu", "GÓC XANH BÌNH YÊN"],
    memories: ["Những điều mình muốn nhớ", "ALBUM SCRAPBOOK"],
    music: ["Một chút dịu dàng", "MÁY NGHE NHẠC NHỎ"],
    wishes: ["Điều ước hôm nay", "GỬI MONG MUỐN LÊN TRỜI"],
    card: ["Tạo một tấm thiệp", "MÓN QUÀ TỰ TAY LÀM"],
    gifts: ["Mở một chiếc hộp nhé", "BẤT NGỜ NHO NHỎ"],
    settings: ["Tùy chọn của cậu", "MỌI THỨ THEO CÁCH CỦA CẬU"]
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

  function renderMood() {
    const moods = [
      ["sun", "🌞", "Vui vẻ", "Mong niềm vui ấy ở lại thêm một chút. Cậu có thể tận hưởng nó theo cách của mình."],
      ["calm", "🌷", "Bình yên", "Thật dễ chịu khi có một khoảng lặng. Cậu cứ ở đây lâu tùy ý nhé."],
      ["tired", "☁️", "Hơi mệt", "Cậu có thể nghỉ một chút mà không cần thấy áy náy. Mình gửi cậu một góc thật êm."],
      ["sad", "🌧️", "Buồn một chút", "Không sao đâu, hôm nay cậu không cần phải cố tỏ ra ổn. Mình ở đây để gửi cậu một chút dịu dàng."],
      ["messy", "🌪️", "Rối bời", "Cậu không cần giải quyết tất cả mọi thứ ngay lúc này. Mình thử dừng lại một chút nhé?"],
      ["care", "🫂", "Muốn được quan tâm", "Cậu xứng đáng được để ý và chăm sóc. Mình gửi cậu một cái ôm thật ấm."]
    ];
    return `<p class="dialog-lead">Chọn cảm xúc gần với cậu nhất lúc này. Không có lựa chọn nào sai, và cậu có thể đổi ý bất cứ khi nào.</p>
      <div class="mood-grid">${moods.map(([id, icon, label]) => `<button class="mood-choice" type="button" data-mood="${id}" data-message="${safeText(label)}"><span aria-hidden="true">${icon}</span><small>${label}</small></button>`).join("")}</div>
      <div class="response-box" id="mood-response" hidden><p id="mood-response-text"></p><button class="button button-soft" type="button" data-open="notes">Đọc một lời nhắn nhỏ ↗</button> <button class="text-button" type="button" data-mood-reset>Chọn lại</button></div>
      <p class="inline-status">Lựa chọn này không được lưu lại. Website chỉ là một góc nghỉ ngơi, không thay thế hỗ trợ chuyên môn.</p>`;
  }

  function renderNotes() {
    const categories = [...new Set(config.notes.map((note) => note.category))];
    if (!categories.includes(memoryState.category)) memoryState.category = categories[0];
    return `<p class="dialog-lead">Chọn một chiếc phong thư hoặc để mình rút ngẫu nhiên nhé. Lời nhắn yêu thích được lưu trên thiết bị này.</p>
      <div class="note-categories" role="group" aria-label="Nhóm lời nhắn">${categories.map((category) => `<button class="pill ${category === memoryState.category ? "is-selected" : ""}" data-category="${safeText(category)}" type="button">${safeText(category)}</button>`).join("")}</div>
      <article class="note-paper" aria-live="polite"><span class="note-category-label" id="note-category">${safeText(memoryState.category.toLocaleUpperCase("vi-VN"))}</span><p id="note-text">${safeText(pickNote(memoryState.category))}</p></article>
      <div class="dialog-actions"><button class="button button-primary" type="button" data-note-next>Một lời nhắn khác</button><button class="button button-soft" type="button" data-note-favorite>♡ Lưu yêu thích</button><button class="button button-soft" type="button" data-note-copy>Sao chép</button></div>
      <p class="inline-status" id="note-status" aria-live="polite"></p>
      <div class="soft-card" style="margin-top:12px"><strong>Lời nhắn đã lưu</strong><div id="favorite-notes" class="inline-status"></div></div>`;
  }

  function pickNote(category) {
    const candidates = config.notes.filter((note) => note.category === category);
    if (!candidates.length) return config.notes[0].text;
    const available = candidates.filter((note) => note.text !== memoryState.previousNote);
    const picked = (available.length ? available : candidates)[Math.floor(Math.random() * (available.length || candidates.length))];
    memoryState.previousNote = picked.text;
    return picked.text;
  }

  function renderHug() {
    return `<p class="dialog-lead">Chọn cách cậu muốn được vỗ về. Website không tự phát âm thanh hoặc rung thiết bị.</p>
      <div class="hug-stage" id="hug-stage" aria-live="polite"><span class="hug-arm left" aria-hidden="true">🫶</span><span class="hug-heart" aria-hidden="true">💗</span><span class="hug-arm right" aria-hidden="true">🫶</span></div>
      <p class="hug-message" id="hug-message">Ôm cậu một cái thật lâu. Không cần nói gì cũng được.</p>
      <div class="dialog-actions" style="justify-content:center"><button class="button button-primary" type="button" data-hug="Ôm cậu một cái thật lâu. Không cần nói gì cũng được.">Ôm thật lâu</button><button class="button button-soft" type="button" data-hug="Một cái ôm nhẹ nhàng, vừa đủ để cậu biết mình luôn ở đây.">Ôm nhẹ</button><button class="button button-soft" type="button" data-hug="Mình gửi cậu một cái ôm kèm lời nhắn: hôm nay cậu đã cố gắng nhiều rồi.">Ôm kèm lời nhắn</button><button class="button button-soft" type="button" data-hug="Chụt! Một nụ hôn gió bay đến chỗ cậu đây.">Nụ hôn gió 💋</button></div>`;
  }

  function renderGames() {
    return `<p class="dialog-lead">Chọn trò mình thích. Không cần vội; mục tiêu chỉ là có một khoảnh khắc vui.</p>
      <div class="game-list">
        <button class="game-option" type="button" data-game="catch"><span class="game-emoji">💗</span><span><strong>Bắt lấy trái tim</strong><small>Bắt càng nhiều trái tim càng tốt trong 20 giây.</small></span></button>
        <button class="game-option" type="button" data-game="memory"><span class="game-emoji">🃏</span><span><strong>Tìm cặp hình giống nhau</strong><small>Lật thẻ và tìm đủ bốn cặp đáng yêu.</small></span></button>
        <button class="game-option" type="button" data-game="garden"><span class="game-emoji">🌱</span><span><strong>Chăm sóc khu vườn</strong><small>Tưới cây, đón nắng và gửi lời thương.</small></span></button>
        <button class="game-option" type="button" data-game="quiz"><span class="game-emoji">🌈</span><span><strong>Điều gì khiến cậu mỉm cười?</strong><small>Vài lựa chọn nhỏ tạo thành tấm chân dung vui.</small></span></button>
      </div>`;
  }

  function renderGarden() {
    const garden = getGarden();
    const growth = Math.min(100, garden.water * 12 + garden.sun * 10 + garden.love * 8);
    const plant = growth > 75 ? "🌻" : growth > 42 ? "🌿" : growth > 15 ? "🌱" : "🪴";
    return `<p class="dialog-lead">Khu vườn này không cần chăm mỗi ngày đâu. Mỗi lần ghé qua, cậu có thể chọn một điều nho nhỏ.</p>
      <div class="garden-art"><span class="garden-plant" id="garden-plant" role="img" aria-label="Chậu cây đang lớn">${plant}</span><span class="garden-sparkles" aria-hidden="true">${"✦ ".repeat(Math.min(garden.stars, 5))}</span><span class="garden-ground"></span></div>
      <div class="garden-progress" role="progressbar" aria-label="Cây đang lớn lên" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${growth}"><span style="width:${growth}%"></span></div>
      <p class="inline-status" id="garden-status">Cây đã được cậu chăm sóc ${garden.water + garden.sun + garden.love} lần. Trang trí nhỏ: ${garden.decorations}.</p>
      <div class="dialog-actions"><button class="button button-soft" type="button" data-garden="water">💧 Tưới nước</button><button class="button button-soft" type="button" data-garden="sun">☀️ Đón nắng</button><button class="button button-soft" type="button" data-garden="love">💌 Gửi lời thương</button><button class="button button-soft" type="button" data-garden="star">⭐ Nhặt ngôi sao</button></div>
      <div class="dialog-actions"><button class="text-button" type="button" data-garden-reset>Đặt lại khu vườn</button></div>`;
  }

  function renderMemories() {
    if (!config.memories.length) return `<div class="empty-state"><span>📷</span>Chưa có kỷ niệm nào. Thêm ảnh trong <code>js/data.js</code> nhé.</div>`;
    return `<p class="dialog-lead">Những hình bên dưới là ô minh họa, không phải ảnh thật. Thay bằng ảnh mà hai người đồng ý chia sẻ trong <code>js/data.js</code>.</p>
      <div class="memory-gallery">${config.memories.map((item, index) => `<button class="memory-photo" type="button" data-memory-index="${index}" aria-label="Mở kỷ niệm: ${safeText(item.title)}">${item.image ? `<img class="photo-art" src="${safeText(item.image)}" alt="" loading="lazy" width="480" height="420" data-fallback="${safeText(item.emoji || "♡")}">` : `<span class="photo-art" aria-hidden="true">${safeText(item.emoji || "♡")}</span>`}<strong>${safeText(item.title)}</strong><small>${safeText(item.date)} · ${safeText(item.caption)}</small></button>`).join("")}</div>`;
  }

  function renderMusic() {
    if (!config.tracks.length) return `<p class="dialog-lead">Không có âm thanh nào tự động phát. Chỉ những bài do cậu thêm vào cấu hình mới xuất hiện ở đây.</p><div class="empty-state"><span>🎧</span>Chưa có bài hát trong máy nghe nhạc.<br>Thêm tệp âm thanh được phép sử dụng vào <code>assets/audio/</code>, rồi thêm đường dẫn tương đối trong <code>js/data.js</code>.</div>`;
    musicTrackIndex %= config.tracks.length;
    const track = config.tracks[musicTrackIndex];
    return `<p class="dialog-lead">Nhấn phát khi cậu sẵn sàng. Nếu tệp không tải được, trình duyệt sẽ báo ở bên dưới.</p>
      <div class="audio-shell"><div class="album-art" aria-hidden="true">♫</div><h3 id="track-title">${safeText(track.title)}</h3><p id="track-artist">${safeText(track.artist || config.sender)}</p>${config.tracks.length > 1 ? `<div class="dialog-actions" style="justify-content:center"><button class="button button-soft" type="button" data-track-step="-1" aria-label="Bài trước">← Trước</button><button class="button button-soft" type="button" data-track-step="1" aria-label="Bài tiếp theo">Tiếp →</button></div>` : ""}<audio controls preload="none" id="audio-player" aria-label="Trình phát nhạc" src="${safeText(track.src)}"></audio><p class="inline-status" id="audio-status" aria-live="polite"></p></div>`;
  }

  function renderWishes() {
    const wishes = storage.get("wishes", []);
    return `<p class="dialog-lead">Một điều ước không cần thành hiện thực ngay để có ý nghĩa. Điều ước chỉ được lưu trên thiết bị này.</p>
      <form class="wish-form" id="wish-form"><label class="sr-only" for="wish-input">Điều ước của cậu</label><input class="text-input" id="wish-input" name="wish" maxlength="140" required placeholder="Mình mong rằng..."><button class="button button-primary" type="submit">Gửi lên trời ✨</button></form>
      <p class="inline-status">Tối đa 140 ký tự. Dữ liệu ở lại trên trình duyệt hiện tại.</p>
      <div class="wish-list" id="wish-list">${wishes.length ? wishes.map((wish, index) => `<div class="wish-item"><p>⭐ ${safeText(wish)}</p><button class="wish-delete" type="button" data-wish-edit="${index}" aria-label="Sửa điều ước" title="Sửa">✎</button><button class="wish-delete" type="button" data-wish-delete="${index}" aria-label="Xóa điều ước" title="Xóa">×</button></div>`).join("") : `<div class="empty-state"><span>🌟</span>Chưa có điều ước nào. Cậu có thể viết điều đầu tiên.</div>`}</div>
      <div class="response-box">Hy vọng sẽ có một ngày thật đẹp đang chờ cậu ở phía trước. 🌙</div>`;
  }

  function renderCard() {
    return `<p class="dialog-lead">Tạo tấm thiệp để tải xuống, sao chép lời nhắn hoặc chia sẻ khi trình duyệt hỗ trợ.</p>
      <div class="card-preview" id="card-preview"><div><span id="card-emoji">💗</span><div id="card-text">Gửi cậu một chút dịu dàng hôm nay.</div><small>— ${safeText(config.sender)}</small></div></div>
      <div class="card-controls">
        <div><label class="input-label" for="card-theme">Phong cách</label><select class="select-input" id="card-theme"><option value="pastel">Pastel</option><option value="sky">Bầu trời đêm</option><option value="garden">Khu vườn</option><option value="heart">Trái tim</option></select></div>
        <div><label class="input-label" for="card-sticker">Sticker</label><select class="select-input" id="card-sticker"><option>💗</option><option>🌷</option><option>🌙</option><option>☁️</option><option>🐈</option><option>⭐</option></select></div>
        <div class="full-width"><label class="input-label" for="card-message">Lời nhắn (tối đa 180 ký tự)</label><textarea class="text-area" id="card-message" maxlength="180">Gửi cậu một chút dịu dàng hôm nay.</textarea></div>
      </div>
      <div class="dialog-actions"><button class="button button-primary" type="button" data-card-download>Tải thiệp PNG</button><button class="button button-soft" type="button" data-card-copy>Sao chép lời nhắn</button><button class="button button-soft" type="button" data-card-share>Chia sẻ</button></div>
      <p class="inline-status" id="card-status" aria-live="polite"></p>`;
  }

  function renderGifts() {
    const labels = Object.keys(config.gifts);
    return `<p class="dialog-lead">Mỗi chiếc hộp giấu một câu nhắn hoặc một món quà nhỏ có thể đổi lấy khi hai người muốn.</p>
      <div class="gift-grid">${labels.map((label) => `<button class="gift-box" type="button" data-gift="${safeText(label)}"><span aria-hidden="true">🎁</span>${safeText(label)}</button>`).join("")}</div>
      <div class="gift-reveal" id="gift-reveal" aria-live="polite">Chọn một chiếc hộp nhé ✨</div>`;
  }

  function renderSettings() {
    const settings = storage.get("settings", { decoration: true, sound: false });
    return `<p class="dialog-lead">Mặc định âm thanh tắt. Hiệu ứng trang trí có thể bật/tắt tùy ý.</p>
      <div class="settings-list">
        <label class="setting-row"><span><strong>Hiệu ứng trang trí</strong><small>Chuyển động nhẹ và hạt lấp lánh.</small></span><input type="checkbox" data-setting="decoration" ${settings.decoration ? "checked" : ""}></label>
        <label class="setting-row"><span><strong>Âm thanh tương tác</strong><small>Hiện chưa có hiệu ứng âm thanh để phát.</small></span><input type="checkbox" data-setting="sound" ${settings.sound ? "checked" : ""} disabled></label>
      </div>
      <p class="inline-status">Tên, nội dung, ảnh và danh sách nhạc có thể sửa trong <code>js/data.js</code>.</p>`;
  }

  function bindDialogActions() {
    const noteText = $("#note-text");
    if (noteText) updateFavoriteStatus();
    const audio = $("#audio-player");
    if (audio) {
      audio.addEventListener("error", () => { $("#audio-status").textContent = "Không thể phát tệp này. Kiểm tra đường dẫn tương đối và định dạng âm thanh."; });
    }
  }

  function updateFavoriteStatus() {
    const target = $("#favorite-notes");
    if (!target) return;
    const favorites = storage.get("favoriteNotes", []);
    if (!favorites.length) {
      target.textContent = "Chưa lưu lời nhắn nào.";
      return;
    }
    target.innerHTML = `<ul>${favorites.map((note, index) => `<li>${safeText(note)} <button class="text-button" type="button" data-favorite-remove="${index}" aria-label="Bỏ yêu thích lời nhắn ${index + 1}">Bỏ lưu</button></li>`).join("")}</ul>`;
  }

  function changeNoteCategory(category) {
    memoryState.category = category;
    const noteText = $("#note-text");
    if (!noteText) return;
    noteText.textContent = pickNote(category);
    $("#note-category").textContent = category.toLocaleUpperCase("vi-VN");
    $$(".note-categories .pill").forEach((button) => button.classList.toggle("is-selected", button.dataset.category === category));
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Đã sao chép vào bộ nhớ tạm.");
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      if (copied) toast("Đã sao chép vào bộ nhớ tạm.");
      else toast("Không thể sao chép tự động trên trình duyệt này.");
    }
  }

  function startCatchGame() {
    const duration = 20;
    let score = 0;
    let seconds = duration;
    showDialog("Bắt lấy trái tim", "TRÒ CHƠI NHỎ", `<p class="dialog-lead">Chạm vào trái tim trong khu vườn để bắt lấy nhé!</p><div class="game-board" id="catch-board"><div class="game-stats"><span>Điểm: <b id="catch-score">0</b></span><span>Còn lại: <b id="catch-time">${duration}</b>s</span></div><button class="catch-target" id="catch-target" type="button" aria-label="Bắt trái tim">💗</button><div id="catch-result" class="response-box" hidden></div></div><div class="dialog-actions"><button class="button button-primary" type="button" data-catch-restart>Chơi lại</button><button class="button button-soft" type="button" data-game-menu>Chọn trò khác</button></div>`);
    const target = $("#catch-target");
    const board = $("#catch-board");
    const moveTarget = () => {
      const left = 8 + Math.random() * 76;
      const top = 28 + Math.random() * 54;
      target.style.left = `${left}%`;
      target.style.top = `${top}%`;
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
      $("#catch-time").textContent = String(seconds);
      if (seconds <= 0) {
        window.clearInterval(catchTimer);
        target.hidden = true;
        const result = $("#catch-result");
        result.hidden = false;
        result.textContent = `Cậu đã bắt được ${score} trái tim. Cảm ơn cậu đã chơi cùng mình!`;
        storage.set("garden", { ...storage.get("garden", {}), decorations: (storage.get("garden", {}).decorations || 0) + 1 });
      }
    }, 1000);
  }

  function startMemoryGame() {
    const symbols = ["💗", "🌷", "🐈", "⭐", "☁️", "🍓", "🦋", "🌙"];
    const deck = [...symbols.slice(0, 4), ...symbols.slice(0, 4)].sort(() => Math.random() - .5);
    let opened = [];
    let matched = 0;
    let moves = 0;
    showDialog("Tìm những cặp giống nhau", "TRÒ CHƠI NHỎ", `<p class="dialog-lead">Lật hai tấm thẻ một lượt để tìm đủ bốn cặp nhé.</p><div class="game-stats"><span>Lượt lật: <b id="memory-moves">0</b></span><span>Đã tìm: <b id="memory-matched">0</b>/4</span></div><div class="memory-grid" id="memory-grid">${deck.map((symbol, index) => `<button class="memory-card" type="button" data-card-index="${index}" aria-label="Thẻ úp">?</button>`).join("")}</div><div class="response-box" id="memory-result" hidden>Giỏi quá, cậu đã tìm đủ các cặp rồi! 🎉</div><div class="dialog-actions"><button class="button button-primary" type="button" data-game="memory">Chơi lại</button><button class="button button-soft" type="button" data-game-menu>Chọn trò khác</button></div>`);
    $$(".memory-card", dialogContent).forEach((card) => {
      card.addEventListener("click", () => {
        const index = Number(card.dataset.cardIndex);
        if (opened.length >= 2 || card.classList.contains("is-open") || card.classList.contains("is-matched")) return;
        card.textContent = deck[index];
        card.classList.add("is-open");
        card.setAttribute("aria-label", `Thẻ ${deck[index]}`);
        opened.push({ card, symbol: deck[index] });
        if (opened.length === 2) {
          moves += 1;
          $("#memory-moves").textContent = String(moves);
          if (opened[0].symbol === opened[1].symbol) {
            opened.forEach(({ card: matchedCard }) => matchedCard.classList.add("is-matched"));
            matched += 1;
            $("#memory-matched").textContent = String(matched);
            opened = [];
            if (matched === 4) {
              $("#memory-result").hidden = false;
              storage.set("garden", { ...storage.get("garden", {}), decorations: (storage.get("garden", {}).decorations || 0) + 1 });
            }
          } else {
            const pair = opened;
            memoryTimer = window.setTimeout(() => {
              pair.forEach(({ card: mismatch }) => { mismatch.classList.remove("is-open"); mismatch.textContent = "?"; mismatch.setAttribute("aria-label", "Thẻ úp"); });
              opened = [];
            }, 780);
          }
        }
      });
    });
  }

  function startGardenGame() {
    showDialog("Chăm sóc khu vườn", "TRÒ CHƠI NHỎ", `<p class="dialog-lead">Chọn điều cây cần. Không có đồng hồ và cây không héo nếu cậu rời đi.</p><div class="garden-art"><span class="garden-plant" id="game-plant">🪴</span><span class="garden-ground"></span></div><p class="inline-status" id="plant-status">Cây đang chờ một chút quan tâm của cậu.</p><div class="dialog-actions"><button class="button button-soft" type="button" data-plant="water">💧 Tưới nước</button><button class="button button-soft" type="button" data-plant="sun">☀️ Đón nắng</button><button class="button button-soft" type="button" data-plant="love">💌 Gửi lời thương</button></div><div class="dialog-actions"><button class="button button-soft" type="button" data-game-menu>Chọn trò khác</button></div>`);
    const plant = $("#game-plant");
    const status = $("#plant-status");
    const responses = { water: "Cây đã uống nước, trông tươi tắn hơn rồi.", sun: "Một chút nắng ấm vừa ghé qua khu vườn.", love: "Cây nghe được lời thương và khẽ rung rinh." };
    $$("[data-plant]", dialogContent).forEach((button) => button.addEventListener("click", () => {
      const key = button.dataset.plant;
      const garden = getGarden();
      garden[key] = (garden[key] || 0) + 1;
      storage.set("garden", garden);
      plant.textContent = garden.water + garden.sun + garden.love > 7 ? "🌻" : garden.water + garden.sun + garden.love > 3 ? "🌿" : "🌱";
      plant.classList.add("is-growing");
      status.textContent = responses[key];
      window.setTimeout(() => plant.classList.remove("is-growing"), 350);
    }));
  }

  const quizQuestions = [
    { prompt: "Một buổi thư giãn hợp với cậu nhất là…", options: ["Ngắm mưa bên cửa sổ 🌧️", "Đi dạo lúc hoàng hôn 🌇", "Ở nhà cùng đồ ăn ngon 🍓"] },
    { prompt: "Nếu có một bạn nhỏ đi cùng, cậu chọn…", options: ["Mèo cuộn tròn 🐈", "Thỏ tai mềm 🐇", "Một chú chim líu lo 🐦"] },
    { prompt: "Chút vui hôm nay sẽ là…", options: ["Một bài hát 🎵", "Một món ngọt 🍰", "Một giấc ngủ ngon 🌙"] }
  ];

  function startQuiz() {
    let step = 0;
    const answers = [];
    const renderQuestion = () => {
      const question = quizQuestions[step];
      showDialog("Điều gì khiến cậu mỉm cười?", "TRÒ CHƠI NHỎ", `<p class="dialog-lead">Câu ${step + 1} / ${quizQuestions.length} · Không có đáp án đúng sai.</p><h3>${question.prompt}</h3><div class="quiz-options">${question.options.map((option, index) => `<button class="quiz-choice" type="button" data-answer="${index}">${option}</button>`).join("")}</div><div class="dialog-actions"><button class="button button-soft" type="button" data-game-menu>Thoát trò chơi</button></div>`);
      $$("[data-answer]", dialogContent).forEach((button) => button.addEventListener("click", () => {
        answers.push(question.options[Number(button.dataset.answer)]);
        step += 1;
        if (step < quizQuestions.length) renderQuestion();
        else showQuizResult(answers);
      }));
    };
    renderQuestion();
  }

  function showQuizResult(answers) {
    const text = `Tấm chân dung vui của cậu: ${answers.join(" · ")}. Mong những điều nhỏ này ghé thăm cậu thật sớm!`;
    showDialog("Một tấm chân dung thật riêng", "TRÒ CHƠI NHỎ", `<div class="response-box">${safeText(text)}</div><div class="dialog-actions"><button class="button button-primary" type="button" data-quiz-share>Chia sẻ kết quả</button><button class="button button-soft" type="button" data-game="quiz">Chơi lại</button><button class="button button-soft" type="button" data-game-menu>Chọn trò khác</button></div><p class="inline-status" id="quiz-status" aria-live="polite"></p>`);
  }

  function renderMemoryLightbox(index) {
    const item = config.memories[index];
    if (!item) return;
    memoryState.memoryIndex = index;
    const overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", item.title);
    overlay.innerHTML = `<div class="lightbox-content"><button class="icon-button lightbox-close" type="button" aria-label="Đóng ảnh" style="margin:0 0 12px auto">×</button><div class="lightbox-art" aria-hidden="true">${item.image ? `<img src="${safeText(item.image)}" alt="" data-fallback="${safeText(item.emoji || "♡")}">` : safeText(item.emoji || "♡")}</div><h3>${safeText(item.title)}</h3><p class="lightbox-caption">${safeText(item.date)} · ${safeText(item.caption)}</p><div class="lightbox-controls"><button class="button button-soft" type="button" data-memory-prev>← Trước</button><button class="button button-soft" type="button" data-memory-next>Tiếp →</button></div></div>`;
    dialogContent.append(overlay);
    const close = () => { overlay.remove(); document.removeEventListener("keydown", escape); };
    const escape = (event) => { if (event.key === "Escape") close(); };
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    $(".lightbox-close", overlay).addEventListener("click", close);
    $("[data-memory-prev]", overlay).addEventListener("click", () => { close(); renderMemoryLightbox((index - 1 + config.memories.length) % config.memories.length); });
    $("[data-memory-next]", overlay).addEventListener("click", () => { close(); renderMemoryLightbox((index + 1) % config.memories.length); });
    document.addEventListener("keydown", escape);
  }

  function applyCardTheme(theme) {
    const preview = $("#card-preview");
    if (!preview) return;
    const themes = {
      pastel: ["linear-gradient(140deg,#ffe2e9,#f2eaff)", "#493848"],
      sky: ["linear-gradient(140deg,#313b67,#7966a4)", "#fffaf3"],
      garden: ["linear-gradient(140deg,#dff1df,#fff0cf)", "#344d3e"],
      heart: ["linear-gradient(140deg,#ffb9c8,#f7d7e6)", "#653b50"]
    };
    currentCardTheme = theme;
    preview.style.background = themes[theme][0];
    preview.style.color = themes[theme][1];
  }

  function drawCardPng(message) {
    const canvas = document.createElement("canvas");
    const width = 1000;
    const height = 700;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas không khả dụng.");
    canvas.width = width;
    canvas.height = height;
    const themes = {
      pastel: ["#ffe2e9", "#f2eaff", "#493848"],
      sky: ["#313b67", "#7966a4", "#fffaf3"],
      garden: ["#dff1df", "#fff0cf", "#344d3e"],
      heart: ["#ffb9c8", "#f7d7e6", "#653b50"]
    };
    const [first, second, ink] = themes[currentCardTheme];
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, first); gradient.addColorStop(1, second);
    context.fillStyle = gradient; context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(255,255,255,.42)";
    context.beginPath(); context.roundRect(35, 35, width - 70, height - 70, 38); context.fill();
    context.textAlign = "center";
    context.fillStyle = ink;
    context.font = "72px 'Be Vietnam Pro', sans-serif";
    context.fillText(currentCardEmoji, width / 2, 220);
    context.font = "44px 'Be Vietnam Pro', sans-serif";
    const words = message.trim().split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > 780 && line) { lines.push(line); line = word; }
      else line = next;
    });
    if (line) lines.push(line);
    const shown = lines.slice(0, 4);
    const startY = 335 - (shown.length - 1) * 29;
    shown.forEach((row, index) => context.fillText(row, width / 2, startY + index * 62));
    context.font = "30px 'Be Vietnam Pro', sans-serif";
    context.fillText(`— ${config.sender}`, width / 2, 590);
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không thể tạo tệp PNG.")), "image/png"));
  }

  function bindGlobalEvents() {
    document.addEventListener("click", async (event) => {
      const trigger = event.target.closest("[data-open]");
      if (trigger) { openFeature(trigger.dataset.open); return; }
      const category = event.target.closest("[data-category]");
      if (category) { changeNoteCategory(category.dataset.category); return; }
      const mood = event.target.closest("[data-mood]");
      if (mood) {
        $("#mood-response-text").textContent = mood.dataset.message;
        $("#mood-response").hidden = false;
        const expressions = { sun: "^ᴗ^", calm: "˘ᴗ˘", tired: "ᴗ̀_ᴗ́", sad: "ᴗ́︿ᴗ̀", messy: "°ロ°", care: "ᵕᴗᵕ" };
        $(".mascot-face").textContent = expressions[mood.dataset.mood] || "ᵔᴗᵔ";
        $("#mascot").setAttribute("aria-label", `Mascot đang đồng cảm với cảm xúc: ${mood.dataset.message}`);
        return;
      }
      if (event.target.closest("[data-mood-reset]")) { $("#mood-response").hidden = true; return; }
      const hug = event.target.closest("[data-hug]");
      if (hug) {
        $("#hug-message").textContent = hug.dataset.hug;
        $("#hug-stage").classList.add("is-hugging");
        burst($("#hug-stage"), "♡");
        window.setTimeout(() => $("#hug-stage")?.classList.remove("is-hugging"), 1050);
        return;
      }
      if (event.target.closest("[data-note-next]")) {
        $("#note-text").textContent = pickNote(memoryState.category);
        $("#note-status").textContent = "";
        return;
      }
      if (event.target.closest("[data-note-favorite]")) {
        const text = $("#note-text").textContent;
        const favorites = storage.get("favoriteNotes", []);
        if (favorites.includes(text)) toast("Lời nhắn này đã nằm trong mục yêu thích rồi.");
        else { favorites.push(text); storage.set("favoriteNotes", favorites); toast("Đã lưu lời nhắn yêu thích."); }
        updateFavoriteStatus();
        return;
      }
      if (event.target.closest("[data-note-copy]")) { await copyText($("#note-text").textContent); return; }
      const favoriteRemove = event.target.closest("[data-favorite-remove]");
      if (favoriteRemove) {
        const favorites = storage.get("favoriteNotes", []);
        favorites.splice(Number(favoriteRemove.dataset.favoriteRemove), 1);
        storage.set("favoriteNotes", favorites);
        updateFavoriteStatus();
        toast("Đã bỏ lời nhắn khỏi mục yêu thích.");
        return;
      }
      const trackStep = event.target.closest("[data-track-step]");
      if (trackStep) {
        musicTrackIndex = (musicTrackIndex + Number(trackStep.dataset.trackStep) + config.tracks.length) % config.tracks.length;
        const track = config.tracks[musicTrackIndex];
        const audio = $("#audio-player");
        audio.pause();
        audio.src = track.src;
        audio.load();
        $("#track-title").textContent = track.title;
        $("#track-artist").textContent = track.artist || config.sender;
        $("#audio-status").textContent = "";
        return;
      }
      const game = event.target.closest("[data-game]");
      if (game) {
        const games = { catch: startCatchGame, memory: startMemoryGame, garden: startGardenGame, quiz: startQuiz };
        games[game.dataset.game]?.();
        return;
      }
      if (event.target.closest("[data-game-menu]")) { openFeature("games"); return; }
      if (event.target.closest("[data-catch-restart]")) { startCatchGame(); return; }
      if (event.target.closest("[data-garden]")) {
        const action = event.target.closest("[data-garden]").dataset.garden;
        const garden = getGarden();
        if (action === "star") { garden.stars += 1; garden.decorations += 1; }
        else garden[action] = (garden[action] || 0) + 1;
        storage.set("garden", garden);
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
      const memory = event.target.closest("[data-memory-index]");
      if (memory) { renderMemoryLightbox(Number(memory.dataset.memoryIndex)); return; }
      const gift = event.target.closest("[data-gift]");
      if (gift) {
        const options = config.gifts[gift.dataset.gift];
        const item = options[Math.floor(Math.random() * options.length)];
        $("#gift-reveal").textContent = item;
        burst(gift, "✦");
        return;
      }
      const wishDelete = event.target.closest("[data-wish-delete]");
      if (wishDelete) {
        const wishes = storage.get("wishes", []);
        wishes.splice(Number(wishDelete.dataset.wishDelete), 1);
        storage.set("wishes", wishes);
        openFeature("wishes");
        toast("Đã xóa điều ước.");
        return;
      }
      const wishEdit = event.target.closest("[data-wish-edit]");
      if (wishEdit) {
        const index = Number(wishEdit.dataset.wishEdit);
        const wishes = storage.get("wishes", []);
        $("#wish-input").value = wishes[index] || "";
        $("#wish-form").dataset.editingIndex = String(index);
        $("#wish-form").querySelector('button[type="submit"]').textContent = "Lưu chỉnh sửa";
        $("#wish-input").focus();
        return;
      }
      const setting = event.target.closest("[data-setting]");
      if (setting) {
        const settings = storage.get("settings", { decoration: true, sound: false });
        settings[setting.dataset.setting] = setting.checked;
        storage.set("settings", settings);
        document.body.classList.toggle("decorations-off", !settings.decoration);
        return;
      }
      const cardTheme = event.target.closest("#card-theme");
      if (cardTheme) { applyCardTheme(cardTheme.value); return; }
      const cardSticker = event.target.closest("#card-sticker");
      if (cardSticker) { currentCardEmoji = cardSticker.value; $("#card-emoji").textContent = currentCardEmoji; return; }
      if (event.target.closest("[data-card-download]")) {
        try {
          const blob = await drawCardPng($("#card-message").value || "Gửi cậu một chút dịu dàng hôm nay.");
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = "dieu-diu-dang-danh-cho-cau.png";
          link.click();
          URL.revokeObjectURL(link.href);
          toast("Tấm thiệp PNG đã được tải xuống.");
        } catch (error) { $("#card-status").textContent = `Không thể tạo thiệp: ${error.message}`; }
        return;
      }
      if (event.target.closest("[data-card-copy]")) { await copyText($("#card-message").value); return; }
      if (event.target.closest("[data-card-share]")) {
        try {
          const blob = await drawCardPng($("#card-message").value || "Gửi cậu một chút dịu dàng hôm nay.");
          const file = new File([blob], "thiep-nho.png", { type: "image/png" });
          if (navigator.canShare?.({ files: [file] }) && navigator.share) await navigator.share({ files: [file], title: "Một tấm thiệp nhỏ", text: $("#card-message").value });
          else if (navigator.share) await navigator.share({ title: "Một tấm thiệp nhỏ", text: $("#card-message").value });
          else { await copyText($("#card-message").value); $("#card-status").textContent = "Trình duyệt chưa hỗ trợ chia sẻ; lời nhắn đã được sao chép."; }
        } catch (error) { if (error.name !== "AbortError") $("#card-status").textContent = "Không thể chia sẻ lúc này. Cậu có thể tải PNG hoặc sao chép lời nhắn."; }
        return;
      }
      if (event.target.closest("[data-quiz-share]")) {
        const result = $(".response-box", dialogContent).textContent;
        if (navigator.share) {
          try { await navigator.share({ title: "Chân dung vui của mình", text: result }); }
          catch (error) { if (error.name !== "AbortError") toast("Không thể chia sẻ lúc này."); }
        } else await copyText(result);
      }
    });

    dialog.addEventListener("click", (event) => {
      if (event.target.closest(".dialog-close")) closeDialog();
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener("close", cleanupGame);
    $("#open-gift").addEventListener("click", () => {
      startExperience();
      burst($(".envelope-art"), "♡");
      openFeature("notes");
    });
    $("#skip-welcome").addEventListener("click", startExperience);
    dialogContent.addEventListener("input", (event) => {
      if (event.target.id === "card-message") $("#card-text").textContent = event.target.value || " ";
    });
    dialogContent.addEventListener("error", (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.dataset.fallback) return;
      const fallback = document.createElement("span");
      fallback.className = image.className;
      fallback.setAttribute("aria-hidden", "true");
      fallback.textContent = image.dataset.fallback;
      image.replaceWith(fallback);
    }, true);
    dialogContent.addEventListener("change", (event) => {
      if (event.target.id === "card-theme") applyCardTheme(event.target.value);
      if (event.target.id === "card-sticker") { currentCardEmoji = event.target.value; $("#card-emoji").textContent = currentCardEmoji; }
    });
    dialogContent.addEventListener("submit", (event) => {
      if (event.target.id !== "wish-form") return;
      event.preventDefault();
      const field = $("#wish-input");
      const wish = field.value.trim();
      if (!wish || wish.length > 140) return;
      const wishes = storage.get("wishes", []);
      const editingIndex = event.target.dataset.editingIndex;
      if (editingIndex === undefined) wishes.unshift(wish);
      else wishes[Number(editingIndex)] = wish;
      storage.set("wishes", wishes.slice(0, 50));
      openFeature("wishes");
      toast(editingIndex === undefined ? "Điều ước của cậu đã được gửi lên trời. ⭐" : "Điều ước đã được cập nhật.");
      burst(dialogContent, "✦");
    });
  }

  function initialize() {
    greeting();
    const settings = storage.get("settings", { decoration: true, sound: false });
    document.body.classList.toggle("decorations-off", !settings.decoration);
    bindGlobalEvents();
  }

  initialize();
})();
