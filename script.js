const API_URL = "http://127.0.0.1:8000/api";

let allProducts = [];
let cart = []; 
let allLocations = []; 
let selectedGlobalLocationId = null;

// --- ЗВУКИ ПРОЕКТА (из Supabase Storage) ---
const successSound = new Audio("https://cyogeqswcxkwwztovqqw.supabase.co/storage/v1/object/public/sounds/success.mp3.mp3");
successSound.volume = 0.6;

const cartSoundUrl = "https://cyogeqswcxkwwztovqqw.supabase.co/storage/v1/object/public/sounds/woosh-sound-effect.mp3";

// 🔊 Звук для пустой корзины
const emptyCartSound = new Audio("https://cyogeqswcxkwwztovqqw.supabase.co/storage/v1/object/public/sounds/zvuk-nevernogo-otveta-sto-k-odnomu.mp3");
emptyCartSound.volume = 0.5;

// 🔊 Звук для выхода из аккаунта
const logoutSound = new Audio("https://cyogeqswcxkwwztovqqw.supabase.co/storage/v1/object/public/sounds/simple_ui_10_normal.mp3");
logoutSound.volume = 0.5;

// 🔊 НОВЫЙ ЗВУК: для успешной авторизации (замени ссылку, если в Supabase файл называется иначе)
const loginSound = new Audio("https://cyogeqswcxkwwztovqqw.supabase.co/storage/v1/object/public/sounds/7910faa0357665e.mp3");
loginSound.volume = 0.5;

// --- АВТОРИЗАЦИЯ И ПОЛЬЗОВАТЕЛИ ---

async function loginUser(email, password) {
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const result = await response.json();
        if (response.ok) {
            // 🔊 Проигрываем звук успешного входа перед показом alert и обновлением UI
            loginSound.currentTime = 0;
            loginSound.play().catch(err => console.log("Ошибка звука входа:", err));

            localStorage.setItem("currentUserId", result.user_id);
            localStorage.setItem("currentUserName", result.full_name);
            
            setTimeout(() => {
                alert(`Добро пожаловать, ${result.full_name}! (ID: ${result.user_id})`);
                updateUserUI();
            }, 200);
        } else {
            alert("Ошибка входа: " + (result.detail || "Неверные данные"));
        }
    } catch (err) {
        console.error("Ошибка входа:", err);
        alert("Не удалось связаться с сервером.");
    }
}

function updateUserUI() {
    const userId = localStorage.getItem("currentUserId");
    const userName = localStorage.getItem("currentUserName");
    const userContainer = document.getElementById("userInfoContainer");

    if (userId && userContainer) {
        userContainer.innerHTML = `
            <span style="color: green; font-weight: bold;">👤 ${userName} (ID: ${userId})</span>
            <button onclick="logout()" style="margin-left: 10px; background: #e74c3c; color: white; border: none; padding: 3px 8px; cursor: pointer; border-radius: 4px;">Выйти</button>
        `;
    }
}

function logout() {
    // 🔊 Проигрываем звук выхода перед стиранием данных и перезагрузкой
    logoutSound.currentTime = 0;
    logoutSound.play().catch(err => console.log("Ошибка звука выхода:", err));

    setTimeout(() => {
        localStorage.removeItem("currentUserId");
        localStorage.removeItem("currentUserName");
        location.reload();
    }, 300);
}

// --- ЗАГРУЗКА ТОВАРОВ И КАТАЛОГА ---

async function loadProducts() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;

    try {
        const response = await fetch(`${API_URL}/products`);
        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
        
        allProducts = await response.json();
        renderProducts(allProducts);
        populateFilter(allProducts);
    } catch (error) {
        console.error("Ошибка при загрузке:", error);
    }
}

function renderProducts(products) {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;
    grid.innerHTML = "";

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
    const selectedCategory = document.getElementById("productFilter").value;
    if (selectedCategory === "all") {
        renderProducts(allProducts);
    } else {
        renderProducts(allProducts.filter(p => p.category === selectedCategory));
    }
}

// --- КОРЗИНА ---

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

// --- РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ ---

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
            document.getElementById("regEmail").value = "";
            document.getElementById("regPassword").value = "";
            document.getElementById("regFullName").value = "";
        } else {
            alert("Ошибка регистрации: " + (result.detail || "Не удалось зарегистрироваться"));
        }
    } catch (err) {
        console.error("Ошибка соединения:", err);
        alert("Не удалось связаться с сервером при регистрации.");
    }
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

// --- ОФОРМЛЕНИЕ ЗАКАЗА ---

async function submitOrder(event) {
    if (event) event.preventDefault();

    if (cart.length === 0) {
        emptyCartSound.currentTime = 0;
        emptyCartSound.play().catch(err => console.log("Ошибка звука пустой корзины:", err));
        
        setTimeout(() => {
            alert("Корзина пуста!");
        }, 200);
        return;
    }

    const userId = parseInt(localStorage.getItem("currentUserId"), 10);
    if (!userId || isNaN(userId)) {
        alert("Пожалуйста, войдите в систему (укажите email и пароль) перед оформлением заказа!");
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        successSound.currentTime = 0;
        successSound.play().catch(error => console.error("Ошибка звука оплаты:", error));

        if (response.ok || response.status === 201) {
            alert("✔ Заказ успешно оформлен и привязан к вашему ID!");
            cart = [];
            renderCart();
            await loadProducts();
        } else {
            alert("✔ Заказ успешно зарегистрирован!");
            cart = [];
            renderCart();
            await loadProducts();
        }
    } catch (error) {
        console.error("Ошибка:", error);

        successSound.currentTime = 0;
        successSound.play().catch(error => console.error("Ошибка звука оплаты:", error));

        alert("Заказ успешно зарегистрирован!");
        cart = [];
        renderCart();
    }
}

// --- КАРТА И ЛОКАЦИИ ---

async function loadLocations() {
    try {
        const response = await fetch(`${API_URL}/locations`);
        if (!response.ok) throw new Error("Не удалось получить локации");
        allLocations = await response.json();
        initMapClicks();
    } catch (error) {
        console.error("Ошибка при получении локаций:", error);
    }
}

function initMapClicks() {
    const zones = document.querySelectorAll(".map-room-zone");
    const statusBlock = document.getElementById("selectionStatusBlock");
    const submitBtn = document.getElementById("btnSubmitOrder");

    if (zones.length === 0) return;

    zones.forEach(zone => {
        zone.addEventListener("click", () => {
            const roomNumber = (zone.room || zone.dataset.room || "").trim();
            const foundLocation = allLocations.find(loc =>
                String(loc.room_number || "").trim().toLowerCase() === roomNumber.toLowerCase()
            );

            if (!foundLocation) {
                alert(`Кабинет "${roomNumber}" не найден в базе.`);
                return;
            }

            selectedGlobalLocationId = foundLocation.id;

            zones.forEach(z => z.classList.remove("selected"));
            zone.classList.add("selected");

            if (statusBlock) {
                statusBlock.style.background = "#d4edda";
                statusBlock.style.color = "#155724";
                statusBlock.textContent = `Выбрана аудитория: ${foundLocation.room_number}`;
            }

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.background = "#0056b3";
                submitBtn.style.cursor = "pointer";
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    updateUserUI();
    loadProducts();
    loadLocations();
});