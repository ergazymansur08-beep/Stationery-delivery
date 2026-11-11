const API_URL = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? "http://127.0.0.1:8000/api"
    : "/api";

let allProducts = [];
let cart = [];
let allLocations = [];
let selectedGlobalLocationId = null;
let currentFloor = 1;

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="100%" height="100%" fill="#eef2f5"/><text x="50%" y="50%" fill="#999" font-family="Arial" font-size="14" text-anchor="middle" dominant-baseline="middle">Нет фото</text></svg>'
);

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ===================== ЗВУКИ =====================
const SOUNDS_BASE = "https://cyogeqswcxkwwztovqqw.supabase.co/storage/v1/object/public/sounds/";
const successSound = new Audio(SOUNDS_BASE + "success.mp3.mp3");
successSound.volume = 0.6;
const cartSoundUrl = SOUNDS_BASE + "woosh-sound-effect.mp3";
const emptyCartSound = new Audio(SOUNDS_BASE + "zvuk-nevernogo-otveta-sto-k-odnomu.mp3");
emptyCartSound.volume = 0.5;
const logoutSound = new Audio(SOUNDS_BASE + "simple_ui_10_normal.mp3");
logoutSound.volume = 0.5;
const loginSound = new Audio(SOUNDS_BASE + "7910faa0357665e.mp3");
loginSound.volume = 0.5;

// ===================== ВХОД / РЕГИСТРАЦИЯ =====================
async function loginUser(email, password) {
    if (!email || !password) {
        alert("Введите email и пароль!");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const result = await response.json();

        if (response.ok) {
            loginSound.currentTime = 0;
            loginSound.play().catch(err => console.log("Ошибка звука входа:", err));

            localStorage.setItem("currentUserId", result.user_id);
            localStorage.setItem("currentUserName", result.full_name);
            localStorage.setItem("userRole", result.role || "student");

            if (result.access_token) {
                localStorage.setItem("token", result.access_token);
            }

            setTimeout(() => {
                const userRole = (result.role || "").toLowerCase().trim();
                if (userRole === "administrator" || userRole === "admin") {
                    alert(`Добро пожаловать, администратор ${result.full_name}!`);
                    window.location.href = "admin.html";
                } else {
                    alert(`Добро пожаловать, ${result.full_name}! (ID: ${result.user_id})`);
                    updateUserUI();
                }
            }, 200);
        } else {
            alert("Ошибка входа: " + (result.detail || "Неверные данные"));
        }
    } catch (err) {
        console.error("Ошибка входа:", err);
        alert("Не удалось связаться с сервером.");
    }
}

async function registerUser(email, password, fullName) {
    if (!email || !password || !fullName) {
        alert("Заполните все поля для регистрации!");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, full_name: fullName })
        });
        const result = await response.json();
        if (response.ok) {
            alert("Регистрация успешна! Теперь вы можете войти.");
        } else {
            const detail = typeof result.detail === "string" ? result.detail : "Проверьте данные (пароль от 6 символов)";
            alert("Ошибка регистрации: " + detail);
        }
    } catch (err) {
        console.error("Ошибка соединения:", err);
        alert("Не удалось связаться с сервером при регистрации.");
    }
}

function updateUserUI() {
    const userId = localStorage.getItem("currentUserId");
    const userName = localStorage.getItem("currentUserName");
    const userContainer = document.getElementById("userInfoContainer");

    if (userId && userContainer) {
        userContainer.innerHTML = `
            <div style="padding: 10px; background: #fff; margin-bottom: 15px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: green; font-weight: bold;">👤 ${escapeHtml(userName)} (ID: ${escapeHtml(userId)})</span>
                <button onclick="logout()" style="background: #e74c3c; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px;">Выйти</button>
            </div>
        `;
    }
}

function logout() {
    logoutSound.currentTime = 0;
    logoutSound.play().catch(err => console.log("Ошибка звука выхода:", err));

    setTimeout(() => {
        localStorage.removeItem("currentUserId");
        localStorage.removeItem("currentUserName");
        localStorage.removeItem("userRole");
        localStorage.removeItem("token");
        location.reload();
    }, 300);
}

// ===================== ТОВАРЫ =====================
async function loadProducts() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;

    try {
        const response = await fetch(`${API_URL}/products`);
        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);

        allProducts = await response.json();
        populateFilter(allProducts);
        renderProductsByFloor(currentFloor);
    } catch (error) {
        console.error("Ошибка при загрузке товаров:", error);
        grid.innerHTML = "<p style='grid-column: 1/-1; text-align: center; color: red;'>Не удалось загрузить товары</p>";
    }
}

function renderProducts(products) {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;
    grid.innerHTML = "";

    if (products.length === 0) {
        grid.innerHTML = "<p style='grid-column: 1/-1; text-align: center;'>Товаров не найдено</p>";
        return;
    }

    products.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        const imgUrl = product.image_url || PLACEHOLDER_IMG;
        const inStock = (product.stock_quantity || 0) > 0;

        card.innerHTML = `
            <div style="text-align: center; margin-bottom: 10px;">
                <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(product.name)}" style="max-width: 100%; height: 120px; object-fit: contain; border-radius: 4px;">
            </div>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.description || "")}</p>
            <p><strong>В наличии:</strong> ${product.stock_quantity} шт.</p>
            <p class="price" style="font-weight: bold; color: #0056b3;">₸ ${product.price}</p>
            <button onclick="addToCart(${product.id})" ${inStock ? "" : "disabled"}
                style="cursor: ${inStock ? "pointer" : "not-allowed"}; padding: 5px 10px; width: 100%; border-radius: 4px; background-color: ${inStock ? "#0056b3" : "#6c757d"}; color: white; border: none;">
                ${inStock ? "+ В корзину" : "Нет в наличии"}
            </button>
        `;
        grid.appendChild(card);
    });
}

function renderProductsByFloor(floor) {
    currentFloor = floor;
    const floorProducts = allProducts.filter(product => (product.floor || 1) === floor);
    const productsToRender = floorProducts.length > 0 ? floorProducts : allProducts;

    const selectedCategory = document.getElementById("productFilter")?.value || "all";
    if (selectedCategory !== "all") {
        renderProducts(productsToRender.filter(p => p.category === selectedCategory));
    } else {
        renderProducts(productsToRender);
    }
}

function populateFilter(products) {
    const select = document.getElementById("productFilter");
    if (!select) return;
    const previous = select.value;
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    select.innerHTML = `<option value="all">Все товары</option>`;
    categories.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
    if (categories.includes(previous)) select.value = previous;
}

function filterProducts() {
    renderProductsByFloor(currentFloor);
}

function switchFloor(floor) {
    currentFloor = floor;

    document.querySelectorAll(".floor-btn").forEach(btn => {
        btn.classList.remove("active");
        if (parseInt(btn.dataset.floor, 10) === floor) {
            btn.classList.add("active");
        }
    });

    document.querySelectorAll(".floor-map-block").forEach(mapBlock => {
        mapBlock.style.display = "none";
    });
    const activeMapBlock = document.getElementById(`map-container-${floor}`);
    if (activeMapBlock) {
        activeMapBlock.style.display = "block";
    }

    renderProductsByFloor(floor);
}

// ===================== КОРЗИНА =====================
function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(item => item.id === productId);
    const currentQty = existing ? existing.quantity : 0;

    if (currentQty + 1 > (product.stock_quantity || 0)) {
        alert(`Больше нет в наличии: «${product.name}» (осталось ${product.stock_quantity} шт.)`);
        return;
    }

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            image_url: product.image_url || ""
        });
    }
    renderCart();

    const audio = new Audio(cartSoundUrl);
    audio.play().catch(error => console.error("Ошибка воспроизведения звука:", error));
}

function renderCart() {
    const cartContainer = document.getElementById("cartItems");
    const cartTotalContainer = document.getElementById("cartTotal");
    if (!cartContainer) return;

    if (cart.length === 0) {
        cartContainer.innerHTML = "<p>Корзина пуста</p>";
        if (cartTotalContainer) cartTotalContainer.textContent = "Итого: ₸ 0";
        return;
    }

    let html = "<ul style='list-style: none; padding: 0;'>";
    let total = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        html += `
            <li style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                <div>
                    <strong>${escapeHtml(item.name)}</strong> — ₸ ${item.price} × ${item.quantity} = <strong>₸ ${itemTotal}</strong>
                </div>
                <div>
                    <button onclick="changeQuantity(${index}, 1)">+</button>
                    <button onclick="changeQuantity(${index}, -1)">-</button>
                    <button onclick="removeFromCart(${index})" style="background: #e74c3c; color: white; border: none; padding: 2px 6px;">✕</button>
                </div>
            </li>
        `;
    });

    html += "</ul>";
    cartContainer.innerHTML = html;
    if (cartTotalContainer) cartTotalContainer.textContent = `Итого: ₸ ${total}`;
}

function changeQuantity(index, delta) {
    const item = cart[index];
    if (!item) return;

    if (delta > 0) {
        const product = allProducts.find(p => p.id === item.id);
        if (product && item.quantity + delta > (product.stock_quantity || 0)) {
            alert(`Больше нет в наличии (осталось ${product.stock_quantity} шт.)`);
            return;
        }
    }

    item.quantity += delta;
    if (item.quantity <= 0) cart.splice(index, 1);
    renderCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

async function submitOrder(event) {
    if (event) event.preventDefault();

    if (cart.length === 0) {
        emptyCartSound.currentTime = 0;
        emptyCartSound.play().catch(err => console.log("Ошибка звука пустой корзины:", err));
        setTimeout(() => alert("Корзина пуста!"), 200);
        return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
        alert("Пожалуйста, войдите в систему перед оформлением заказа!");
        return;
    }

    if (!selectedGlobalLocationId) {
        alert("Сначала выберите аудиторию на карте!");
        return;
    }

    const payload = {
        location_id: selectedGlobalLocationId,
        items: cart.map(item => ({ id: item.id, quantity: item.quantity }))
    };

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const detail = typeof errData.detail === "string"
                ? errData.detail
                : (errData.message || "Ошибка сервера");
            throw new Error(detail);
        }

        successSound.currentTime = 0;
        successSound.play().catch(error => console.error("Ошибка звука оплаты:", error));

        alert("✔ Заказ успешно оформлен!");
        cart = [];
        renderCart();
        await loadProducts();
    } catch (error) {
        console.error("Ошибка:", error);
        alert("Ошибка при оформлении заказа: " + error.message);
    }
}

// ===================== КАРТА =====================
// Координаты кабинетов лежат в map-coords.js (ROOM_COORDS), ключ = id из таблицы delivery_locations
const BLOCK_STYLE = {
    "C1.1": { rgb: "0,123,255",  zone: [6, 30]  },   // слева
    "C1.2": { rgb: "40,167,69",  zone: [36, 64] },   // центр
    "C1.3": { rgb: "230,126,34", zone: [70, 94] },   // справа
    "default": { rgb: "108,117,125", zone: [6, 94] }
};
const CALIBRATE = new URLSearchParams(location.search).has("calibrate");
let calibData = {};
try { calibData = JSON.parse(localStorage.getItem("roomCalib") || "{}"); } catch (e) {}

function getCoords(loc) {
    if (CALIBRATE && calibData[loc.id]) return calibData[loc.id];
    if (typeof ROOM_COORDS !== "undefined" && ROOM_COORDS[loc.id]) return ROOM_COORDS[loc.id];
    return null;
}

async function loadLocations() {
    try {
        const response = await fetch(`${API_URL}/locations`);
        if (!response.ok) throw new Error("Не удалось получить локации");
        allLocations = await response.json();

        renderAllDatabaseRooms();
        initMapClicks();
        if (CALIBRATE) initCalibration();
    } catch (error) {
        console.error("Ошибка при получении локаций:", error);
    }
}

function renderAllDatabaseRooms() {
    document.querySelectorAll(".map-rooms-overlay").forEach(o => o.innerHTML = "");
    const counters = {};

    allLocations.forEach(loc => {
        const floor = loc.floor || 1;
        const overlay = document.querySelector(`.map-rooms-overlay[data-floor-overlay="${floor}"]`);
        if (!overlay) return;

        const style = BLOCK_STYLE[loc.block] || BLOCK_STYLE["default"];
        let pos = getCoords(loc);
        const placed = !!pos;

        if (!pos) {
            // автосетка для кабинетов без координат
            const key = floor + "|" + loc.block;
            const n = counters[key] = (counters[key] ?? -1) + 1;
            const cols = 5;
            const step = (style.zone[1] - style.zone[0]) / cols;
            pos = [style.zone[0] + (n % cols) * step + step / 2, 6 + Math.floor(n / cols) * 4.5];
        }

        const roomNum = String(loc.room_number || "").trim();
        const el = document.createElement("div");
        el.className = "map-room-zone";
        el.dataset.id = loc.id;
        el.dataset.rgb = style.rgb;
        el.textContent = roomNum;
        el.title = `${loc.block}, этаж ${floor}, кабинет ${roomNum}` + (placed ? "" : " (нет координат)");

        el.style.cssText = `
            position: absolute;
            left: ${pos[0]}%;
            top: ${pos[1]}%;
            width: auto;
            height: auto;
            transform: translate(-50%, -50%);
            background: rgba(${style.rgb}, ${placed ? 0.85 : 0.45});
            color: white;
            padding: 2px 4px;
            font-size: 8.5px;
            font-weight: bold;
            border: 1px ${placed ? "solid" : "dashed"} #fff;
            border-radius: 3px;
            cursor: pointer;
            text-align: center;
            box-shadow: 0 1px 2px rgba(0,0,0,0.3);
            white-space: nowrap;
        `;
        overlay.appendChild(el);
    });

    // подсветить ранее выбранный кабинет
    if (selectedGlobalLocationId) {
        const sel = document.querySelector(`.map-room-zone[data-id="${selectedGlobalLocationId}"]`);
        if (sel) { sel.classList.add("selected"); sel.style.background = "#28a745"; }
    }
}

function initMapClicks() {
    const statusBlock = document.getElementById("selectionStatusBlock");
    const submitBtn = document.getElementById("btnSubmitOrder");

    document.addEventListener("click", (e) => {
        if (CALIBRATE) return;
        const zone = e.target.closest(".map-room-zone");
        if (!zone) return;

        const loc = allLocations.find(l => String(l.id) === zone.dataset.id);
        if (!loc) {
            alert("Кабинет не найден в базе.");
            return;
        }

        selectedGlobalLocationId = loc.id;

        document.querySelectorAll(".map-room-zone").forEach(z => {
            z.classList.remove("selected");
            z.style.background = `rgba(${z.dataset.rgb}, 0.85)`;
        });
        zone.classList.add("selected");
        zone.style.background = "#28a745";

        if (statusBlock) {
            statusBlock.style.background = "#d4edda";
            statusBlock.style.color = "#155724";
            statusBlock.textContent = `Выбрана аудитория: ${loc.room_number} (Блок ${loc.block}, Этаж ${loc.floor})`;
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.background = "#0056b3";
            submitBtn.style.cursor = "pointer";
        }
    });
}

// ===================== РЕЖИМ КАЛИБРОВКИ (index.html?calibrate=1) =====================
function initCalibration() {
    const panel = document.createElement("div");
    panel.style.cssText = "position:fixed;right:10px;bottom:10px;width:330px;background:#fff;border:2px solid #0056b3;border-radius:8px;padding:10px;z-index:9999;font-size:13px;box-shadow:0 4px 15px rgba(0,0,0,.3);";
    panel.innerHTML = `
        <b>Калибровка карты</b><br>
        1) Выберите кабинет в списке<br>
        2) Кликните на его место на карте<br>
        <select id="calibSelect" style="width:100%;margin:6px 0;padding:4px;"></select>
        <textarea id="calibOut" readonly style="width:100%;height:110px;font-size:11px;"></textarea>
        <button id="calibCopy" style="padding:4px 8px;">Копировать</button>
        <button id="calibReset" style="padding:4px 8px;">Сбросить мои клики</button>
        <div style="margin-top:4px;color:#666;">Вставьте результат в ROOM_COORDS внутри map-coords.js</div>
    `;
    document.body.appendChild(panel);

    const select = document.getElementById("calibSelect");
    const out = document.getElementById("calibOut");

    function hasCoords(loc) { return !!getCoords(loc); }

    function fillSelect(selectId) {
        const locs = allLocations
            .filter(l => (l.floor || 1) === currentFloor)
            .sort((a, b) =>
                String(a.block).localeCompare(String(b.block)) ||
                String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true }));
        select.innerHTML = "";
        locs.forEach(l => {
            const o = document.createElement("option");
            o.value = l.id;
            o.textContent = `${hasCoords(l) ? "✓" : "○"} ${l.block} — ${l.room_number} (id ${l.id})`;
            select.appendChild(o);
        });
        if (selectId) select.value = selectId;
    }

    function buildOutput() {
        const merged = {};
        if (typeof ROOM_COORDS !== "undefined") Object.assign(merged, ROOM_COORDS);
        Object.assign(merged, calibData);
        out.value = Object.keys(merged).map(Number).sort((a, b) => a - b).map(id => {
            const loc = allLocations.find(l => l.id === id);
            return `    ${id}: [${merged[id][0]}, ${merged[id][1]}], // ${loc ? loc.block + " " + loc.room_number : ""}`;
        }).join("\n");
    }

    function nextUnplaced(currentId) {
        const opts = [...select.options].map(o => o.value);
        const start = opts.indexOf(String(currentId));
        for (let i = 1; i <= opts.length; i++) {
            const id = opts[(start + i) % opts.length];
            const loc = allLocations.find(l => String(l.id) === id);
            if (loc && !hasCoords(loc)) return id;
        }
        return String(currentId);
    }

    document.querySelectorAll(".map-rooms-overlay").forEach(ov => {
        ov.addEventListener("click", (e) => {
            const id = select.value;
            if (!id) return;
            const r = ov.getBoundingClientRect();
            if (!r.width) return;
            const x = +(((e.clientX - r.left) / r.width) * 100).toFixed(1);
            const y = +(((e.clientY - r.top) / r.height) * 100).toFixed(1);
            calibData[id] = [x, y];
            try { localStorage.setItem("roomCalib", JSON.stringify(calibData)); } catch (err) {}
            renderAllDatabaseRooms();
            fillSelect(id);
            const nxt = nextUnplaced(id);
            fillSelect(nxt);
            buildOutput();
        });
    });

    document.querySelectorAll(".floor-btn").forEach(b =>
        b.addEventListener("click", () => setTimeout(() => fillSelect(), 0)));

    document.getElementById("calibCopy").onclick = () => { out.select(); document.execCommand("copy"); };
    document.getElementById("calibReset").onclick = () => {
        if (!confirm("Удалить все клики калибровки из браузера?")) return;
        calibData = {};
        try { localStorage.removeItem("roomCalib"); } catch (err) {}
        renderAllDatabaseRooms(); fillSelect(); buildOutput();
    };

    fillSelect();
    buildOutput();
}

// ===================== СТАРТ =====================
document.addEventListener("DOMContentLoaded", () => {
    updateUserUI();
    loadProducts();
    loadLocations();
});
