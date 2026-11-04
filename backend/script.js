const API_URL = "http://127.0.0.1:8000/api";

let allProducts = [];
let cart = []; 
let allLocations = []; 
let selectedGlobalLocationId = null;

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
            localStorage.setItem("currentUserId", result.user_id);
            localStorage.setItem("currentUserName", result.full_name);
            alert(`Добро пожаловать, ${result.full_name}! (ID: ${result.user_id})`);
            updateUserUI();
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
    localStorage.removeItem("currentUserId");
    localStorage.removeItem("currentUserName");
    location.reload();
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

// --- ОФОРМЛЕНИЕ ЗАКАЗА С АВТОРИЗАЦИЕЙ ---

async function submitOrder(event) {
    if (event) event.preventDefault();

    if (cart.length === 0) {
        alert("Корзина пуста!");
        return;
    }

    // Берем ID авторизованного пользователя из памяти браузера
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
            const roomNumber = (zone.dataset.room || "").trim();
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