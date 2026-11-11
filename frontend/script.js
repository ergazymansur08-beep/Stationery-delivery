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

const roomCoordinates = {
    "139": { top: "22%", left: "27%" },
    "140": { top: "22%", left: "30%" },
    "141": { top: "31%", left: "29%" },
    "142": { top: "36%", left: "29%" },
    "143": { top: "31%", left: "24%" },
    "155": { top: "67%", left: "32%" },
    "163": { top: "63%", left: "32%" },
    "164": { top: "59%", left: "32%" },
    "165": { top: "59%", left: "26%" },
    "168": { top: "50%", left: "25%" },
    "124K": { top: "47%", left: "36%" },
    "123K": { top: "54%", left: "36%" },
    "122K": { top: "60%", left: "37%" },
    "121K": { top: "66%", left: "37%" },
    "138L": { top: "53%", left: "58%" },
    "137P": { top: "59%", left: "58%" },
    "136": { top: "64%", left: "57%" },
    "135": { top: "67%", left: "57%" },
    "221P": { top: "28%", left: "18%" },
    "246": { top: "58%", left: "42%" },
    "318K": { top: "28%", left: "22%" },
    "346P": { top: "58%", left: "45%" }
};

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

    async function loadStock() {
        const tbody = document.getElementById("stockTableBody");
        try {
            const response = await fetch(`${API_URL}/products`);
            if (!response.ok) throw new Error("Ошибка загрузки товаров");
            const products = await response.json();

            tbody.innerHTML = "";
            products.forEach(p => {
                const tr = document.createElement("tr");

                const tdName = document.createElement("td");
                tdName.textContent = p.name;

                const tdCur = document.createElement("td");
                tdCur.textContent = `${p.stock_quantity} шт.`;

                const tdAct = document.createElement("td");
                tdAct.style.textAlign = "right";

                const input = document.createElement("input");
                input.type = "number";
                input.min = "0";
                input.value = p.stock_quantity;
                input.style.cssText = "width: 90px; padding: 6px; margin-right: 8px; border: 1px solid #ccc; border-radius: 6px;";

                const btn = document.createElement("button");
                btn.className = "btn-complete";
                btn.textContent = "Сохранить";
                btn.onclick = () => saveStock(p.id, input, tdCur, btn);

                tdAct.append(input, btn);
                tr.append(tdName, tdCur, tdAct);
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="3" class="empty-msg" style="color: red;">Не удалось загрузить товары.</td></tr>`;
        }
    }

    async function saveStock(productId, input, curCell, btn) {
        const value = parseInt(input.value, 10);
        if (isNaN(value) || value < 0) {
            alert("Введите целое число от 0");
            return;
        }
        btn.disabled = true;
        try {
            const response = await fetch(`${API_URL}/products/${productId}/stock`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token
                },
                body: JSON.stringify({ stock_quantity: value })
            });
            if (!response.ok) throw new Error("Ошибка " + response.status);
            const result = await response.json();
            curCell.textContent = `${result.stock_quantity} шт.`;
            btn.textContent = "✓ Сохранено";
            setTimeout(() => { btn.textContent = "Сохранить"; }, 1500);
        } catch (err) {
            console.error(err);
            alert("Не удалось сохранить количество");
        } finally {
            btn.disabled = false;
        }
    }

document.addEventListener("DOMContentLoaded", () => {
    updateUserUI();
    loadProducts();
    loadLocations();
});
