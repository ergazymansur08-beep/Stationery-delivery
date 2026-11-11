const API_URL = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost" 
    ? "http://127.0.0.1:8000/api" 
    : "/api";

let allProducts = [];
let cart = []; 
let allLocations = []; 
let selectedGlobalLocationId = null;
let currentFloor = 1;

const successSound = new Audio("https://cyogeqswcxkwwztovqqw.supabase.co/storage/v1/object/public/sounds/success.mp3.mp3");
successSound.volume = 0.6;
const cartSoundUrl = "https://cyogeqswcxkwwztovqqw.supabase.co/storage/v1/object/public/sounds/woosh-sound-effect.mp3";
const emptyCartSound = new Audio("https://cyogeqswcxkwwztovqqw.supabase.co/storage/v1/object/public/sounds/zvuk-nevernogo-otveta-sto-k-odnomu.mp3");
emptyCartSound.volume = 0.5;
const logoutSound = new Audio("https://cyogeqswcxkwwztovqqw.supabase.co/storage/v1/object/public/sounds/simple_ui_10_normal.mp3");
logoutSound.volume = 0.5;
const loginSound = new Audio("https://cyogeqswcxkwwztovqqw.supabase.co/storage/v1/object/public/sounds/7910faa0357665e.mp3");
loginSound.volume = 0.5;

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
        alert("Не удалось связаться с сервером. Проверьте запущен ли бэкенд!");
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
            alert("Ошибка регистрации: " + (result.detail || "Не удалось зарегистрироваться"));
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
                <span style="color: green; font-weight: bold;">👤 ${userName} (ID: ${userId})</span>
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

async function loadProducts() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;

    try {
        const response = await fetch(`${API_URL}/products`);
        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
        
        allProducts = await response.json();
        renderProductsByFloor(currentFloor);
        populateFilter(allProducts);
    } catch (error) {
        console.error("Ошибка при загрузке товаров:", error);
    }
}

function renderProducts(products) {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;
    grid.innerHTML = "";

    if (products.length === 0) {
        grid.innerHTML = "<p style='grid-column: 1/-1; text-align: center;'>На этом этаже пока нет товаров</p>";
        return;
    }

    products.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        const imgUrl = product.image_url || "https://unsplash.com";

        card.innerHTML = `
            <div style="text-align: center; margin-bottom: 10px;">
                <img src="${imgUrl}" alt="${product.name}" style="max-width: 100%; height: 120px; object-fit: contain; border-radius: 4px;">
            </div>
            <h3>${product.name}</h3>
            <p>${product.description || ''}</p>
            <p><strong>В наличии:</strong> ${product.stock_quantity} шт.</p>
            <p class="price" style="font-weight: bold; color: #0056b3;">₸ ${product.price}</p>
            <button onclick="addToCart(${product.id}, '${product.name}', ${product.price}, '${imgUrl}')" style="cursor: pointer; padding: 5px 10px; width: 100%; border-radius: 4px; background-color: #0056b3; color: white; border: none;">+ В корзину</button>
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
        const filtered = productsToRender.filter(p => p.category === selectedCategory);
        renderProducts(filtered);
    } else {
        renderProducts(productsToRender);
    }
}

function populateFilter(products) {
    const select = document.getElementById("productFilter");
    if (!select) return;
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    select.innerHTML = `<option value="all">Все товары</option>`;
    categories.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

function filterProducts() {
    renderProductsByFloor(currentFloor);
}

function switchFloor(floor) {
    currentFloor = floor;

    document.querySelectorAll('.floor-btn').forEach(btn => {
        btn.classList.remove('active');
        const targetFloor = parseInt(btn.dataset.floor, 10);
        if (targetFloor === floor) {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('.floor-map-block').forEach(mapBlock => {
        mapBlock.style.display = 'none';
    });
    const activeMapBlock = document.getElementById(`map-container-${floor}`);
    if (activeMapBlock) {
        activeMapBlock.style.display = 'block';
    }

    renderProductsByFloor(floor);
}

function addToCart(id, name, price, imageUrl) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id, name, price, quantity: 1, image_url: imageUrl });
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
                    <strong>${item.name}</strong> — ₸ ${item.price} × ${item.quantity} = <strong>₸ ${itemTotal}</strong>
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
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
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

    const userId = parseInt(localStorage.getItem("currentUserId"), 10);
    if (!userId || isNaN(userId)) {
        alert("Пожалуйста, войдите в систему перед оформлением заказа!");
        return;
    }

    const locationId = selectedGlobalLocationId;
    if (!locationId) {
        alert("Сначала выберите аудиторию на карте!");
        return;
    }

    const payload = {
        user_id: userId,
        location_id: locationId,
        items: cart.map(item => ({ id: item.id, quantity: item.quantity }))
    };

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(JSON.stringify(errData.detail) || errData.message || "Ошибка сервера");
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
            .sort((a, b) => String(a.block).localeCompare(String(b.block)) || String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true }));
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

async function loadLocations() {
    try {
        const response = await fetch(`${API_URL}/locations`);
        if (!response.ok) throw new Error("Не удалось получить локации");
        allLocations = await response.json();
        
        renderAllDatabaseRooms();
        initMapClicks();
    } catch (error) {
        console.error("Ошибка при получении локаций:", error);
    }
}

function renderAllDatabaseRooms() {
    document.querySelectorAll(".map-rooms-overlay").forEach(o => o.innerHTML = "");
    
    const wingCounters = {
        "left": { 1: 0, 2: 0, 3: 0 },
        "center": { 1: 0, 2: 0, 3: 0 },
        "right": { 1: 0, 2: 0, 3: 0 }
    };

    allLocations.forEach((loc) => {
        const floor = loc.floor || 1;
        const overlay = document.querySelector(`.map-rooms-overlay[data-floor-overlay="${floor}"]`);
        
        if (!overlay) return;

        const roomNum = String(loc.room_number || "").trim();
        const roomEl = document.createElement("div");
        roomEl.className = "map-room-zone";
        roomEl.dataset.room = roomNum;
        roomEl.textContent = roomNum;

        let topPos = "20%";
        let leftPos = "50%";

        if (roomCoordinates[roomNum]) {
            topPos = roomCoordinates[roomNum].top;
            leftPos = roomCoordinates[roomNum].left;
        } else {
            let wing = "center";
            const numVal = parseInt(roomNum, 10) || 0;
            
            if (numVal > 0 && numVal % 3 === 0) wing = "left";
            else if (numVal > 0 && numVal % 3 === 1) wing = "right";

            const wIdx = wingCounters[wing][floor]++;

            if (wing === "left") {
                const col = wIdx % 4;
                const row = Math.floor(wIdx / 4);
                topPos = `${32 + (row * 9)}%`;
                leftPos = `${15 + (col * 7)}%`;
            } else if (wing === "right") {
                const col = wIdx % 4;
                const row = Math.floor(wIdx / 4);
                topPos = `${32 + (row * 9)}%`;
                leftPos = `${72 + (col * 7)}%`;
            } else {
                const col = wIdx % 6;
                const row = Math.floor(wIdx / 6);
                topPos = `${24 + (row * 9)}%`;
                leftPos = `${38 + (col * 5.5)}%`;
            }
        }

        roomEl.style.cssText = `
            position: absolute;
            top: ${topPos};
            left: ${leftPos};
            background: rgba(0, 123, 255, 0.85);
            color: white;
            padding: 2px 4px;
            font-size: 8.5px;
            font-weight: bold;
            border: 1px solid #fff;
            border-radius: 3px;
            cursor: pointer;
            text-align: center;
            box-shadow: 0 1px 2px rgba(0,0,0,0.3);
            transition: all 0.2s;
            transform: translate(-50%, -50%);
            white-space: nowrap;
        `;

        overlay.appendChild(roomEl);
    });
}

function initMapClicks() {
    const statusBlock = document.getElementById("selectionStatusBlock");
    const submitBtn = document.getElementById("btnSubmitOrder");

    document.addEventListener("click", (e) => {
        if (!e.target.classList.contains("map-room-zone")) return;

        const roomNumber = (e.target.dataset.room || "").trim();
        const foundLocation = allLocations.find(loc =>
            String(loc.room_number || "").trim().toLowerCase() === roomNumber.toLowerCase()
        );

        if (!foundLocation) {
            alert(`Кабинет "${roomNumber}" не найден в базе.`);
            return;
        }

        selectedGlobalLocationId = foundLocation.id;

        document.querySelectorAll(".map-room-zone").forEach(z => {
            z.classList.remove("selected");
            z.style.background = "rgba(0, 123, 255, 0.85)";
        });

        e.target.classList.add("selected");
        e.target.style.background = "#28a745"; 

        if (statusBlock) {
            statusBlock.style.background = "#d4edda";
            statusBlock.style.color = "#155724";
            statusBlock.textContent = `Выбрана аудитория: ${foundLocation.room_number} (Этаж ${foundLocation.floor}, Блок ${foundLocation.block || 'не указан'})`;
        }

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.background = "#0056b3";
            submitBtn.style.cursor = "pointer";
        }
    });
}

    

document.addEventListener("DOMContentLoaded", () => {
    updateUserUI();
    loadProducts();
    loadLocations();
});
