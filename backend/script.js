// Адрес твоего FastAPI бэкенда
const API_URL = "http://127.0.0.1:8000/api";

let allProducts = [];
let cart = []; // Массив для корзины
const addToCartSound = new Audio("https://cyogeqswcxkwwztovqqw.supabase.co/storage/v1/object/public/sounds/woosh-sound-effect.mp3");
addToCartSound.volume = 0.5;

// 1. Загрузка товаров с бэкенда (FastAPI + Supabase)
async function loadProducts() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;

    try {
        const response = await fetch(`${API_URL}/products`);
        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }
        
        allProducts = await response.json();
        renderProducts(allProducts);
        populateFilter(allProducts);
    } catch (error) {
        console.error("Ошибка при загрузке:", error);
        grid.innerHTML = `<p style="color: red; padding: 10px;">
            Не удалось загрузить товары. Убедитесь, что Python-сервер запущен на http://127.0.0.1:8000
        </p>`;
    }
}

// 2. Рендеринг карточек товаров в сетку
function renderProducts(products) {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;
    
    grid.innerHTML = "";

    if (products.length === 0) {
        grid.innerHTML = "<p>Товары не найдены.</p>";
        return;
    }

    products.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        
        // Используем картинку из базы, либо дефолтную заглушку, если поле пустое
        const imgUrl = product.image_url || "https://unsplash.com";

        card.innerHTML = `
            <div class="product-img-container" style="text-align: center; margin-bottom: 10px;">
                <img src="${imgUrl}" alt="${product.name}" style="max-width: 100%; height: 120px; object-fit: contain; border-radius: 4px;">
            </div>
            <h3>${product.name}</h3>
            <p>${product.description || ''}</p>
            <p><strong>Категория:</strong> ${product.category || 'Общее'}</p>
            <p><strong>В наличии:</strong> ${product.stock_quantity} шт.</p>
            <p class="price" style="font-weight: bold; color: #0056b3;">₸ ${product.price}</p>
            <button onclick="addToCart(${product.id}, '${product.name}', ${product.price}, '${imgUrl}')" style="cursor: pointer; padding: 5px 10px; width: 100%; border-radius: 4px; background-color: #0056b3; color: white; border: none;">+ В корзину</button>
        `;
        grid.appendChild(card);
    });
}

// 3. Заполнение выпадающего списка категорий
function populateFilter(products) {
    const select = document.getElementById("productFilter");
    if (!select) return;

    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    select.innerHTML = `<option value="all">Все товары (Показать всё)</option>`;

    categories.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

// 4. Фильтрация товаров по категории
function filterProducts() {
    const selectedCategory = document.getElementById("productFilter").value;
    if (selectedCategory === "all") {
        renderProducts(allProducts);
    } else {
        const filtered = allProducts.filter(p => p.category === selectedCategory);
        renderProducts(filtered);
    }
}

// 5. Добавление товара в корзину
function addToCart(id, name, price, imageUrl) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        // Добавляем поле image_url в объект товара внутри корзины
        cart.push({ id, name, price, quantity: 1, image_url: imageUrl });
    }

    addToCartSound.currentTime = 0;

    addToCartSound.play().catch(error => {
        console.warn("Не удалось воспроизвести звук:", error);
    });
    renderCart(); // Перерисовываем корзину
}

// 6. Отрисовка корзины покупок
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
                <div style="display: flex; align-items: center; gap: 10px;">
                    <!-- Маленькая превьюшка товара в корзине -->
                    <img src="${item.image_url}" alt="${item.name}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; border: 1px solid #ddd;">
                    <span><strong>${item.name}</strong> — ₸ ${item.price} × ${item.quantity} = <strong>₸ ${itemTotal}</strong></span>
                </div>
                <div>
                    <button onclick="changeQuantity(${index}, 1)" style="padding: 2px 8px; cursor: pointer;">+</button>
                    <button onclick="changeQuantity(${index}, -1)" style="padding: 2px 8px; cursor: pointer;">-</button>
                    <button onclick="removeFromCart(${index})" style="background: #e74c3c; color: white; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; margin-left: 5px;">✕</button>
                </div>
            </li>
        `;
    });

    html += "</ul>";
    cartContainer.innerHTML = html;
    
    if (cartTotalContainer) {
        cartTotalContainer.textContent = `Итого: ₸ ${total}`;
    }

    const totalInput = document.querySelector('input[name="total_amount"]');
    if (totalInput) {
        totalInput.value = total;
    }
}

// 7. Изменение количества товара (+ / -)
function changeQuantity(index, delta) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }
    renderCart();
}

// 8. Удаление товара из корзины
function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

// 9. Отправка заказа на бэкенд без перезагрузки страницы
async function submitOrder(event) {
    event.preventDefault();

    // 1. Проверяем корзину
    if (cart.length === 0) {
        alert("Корзина пуста! Добавьте товары перед оформлением заказа.");
        return;
    }

    // 2. Получаем ID пользователя и выбранной аудитории
    const userId = document.querySelector('input[name="user_id"]').value;
    const locationId = document.getElementById("selectedLocationId").value;

    // 3. Проверяем выбор аудитории
    if (!locationId) {
        alert("Сначала выберите аудиторию на карте!");
        return;
    }

    // 4. Формируем данные для отправки
    const payload = {
        user_id: parseInt(userId, 10),
        location_id: parseInt(locationId, 10),
        items: cart.map(item => ({
            id: item.id,
            quantity: item.quantity
        }))
    };

    // 5. Проверяем корректность ID
    if (
        !Number.isInteger(payload.user_id) ||
        !Number.isInteger(payload.location_id)
    ) {
        alert("Ошибка: некорректный пользователь или адрес доставки.");
        return;
    }

    try {
        // 6. Отправляем заказ на сервер
        const response = await fetch(`${API_URL}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            alert(
                `Заказ №${result.order_id ?? ""} успешно оформлен!`
            );

            // 7. Очищаем корзину
            cart = [];
            renderCart();

            // 8. Обновляем товары и остатки
            await loadProducts();

        } else {
            alert(
                "Ошибка оформления заказа: " +
                (result.detail || "Неизвестная ошибка")
            );
        }

    } catch (error) {
        console.error("Ошибка оформления заказа:", error);
        alert("Не удалось связаться с сервером. Проверь, запущен ли FastAPI.");
    }
}

let allLocations = []; // Храним список аудиторий из Supabase

// 1. Автоматическая загрузка локаций с бэкенда при старте страницы
async function loadLocations() {
    try {
        const response = await fetch(`${API_URL}/locations`);
        if (!response.ok) throw new Error("Не удалось получить локации");
        allLocations = await response.json();
        
        console.log("Локации успешно загружены из Supabase:", allLocations);
        
        // Как только данные загрузились — вешаем обработчики кликов на карту
        initMapClicks();
    } catch (error) {
        console.error("Ошибка при получении локаций:", error);
    }
}

// 2. Инициализация кликов по карте (Слушатели событий)
function initMapClicks() {
    const zones = document.querySelectorAll(".map-room-zone");
    const locationInput = document.getElementById("selectedLocationId");
    const statusBlock = document.getElementById("selectionStatusBlock");
    const submitBtn = document.getElementById("btnSubmitOrder");

    if (!locationInput || !statusBlock || !submitBtn) {
        console.error("Не найдены элементы формы доставки.");
        return;
    }

    zones.forEach(zone => {
        zone.addEventListener("click", () => {
            const roomNumber = zone.dataset.room.trim();

            const foundLocation = allLocations.find(loc =>
                String(loc.room_number || "").trim().toLowerCase()
                === roomNumber.toLowerCase()
            );

            if (!foundLocation) {
                alert(
                    `Кабинет "${roomNumber}" не найден в Supabase.`
                );
                console.warn("Доступные локации:", allLocations);
                return;
            }

            // Сохраняем ID выбранной аудитории
            locationInput.value = foundLocation.id;

            // Отмечаем выбранную зону
            zones.forEach(z => z.classList.remove("selected"));
            zone.classList.add("selected");

            // Показываем выбранный адрес
            statusBlock.style.background = "#d4edda";
            statusBlock.style.color = "#155724";
            statusBlock.style.border = "1px solid #c3e6cb";

            statusBlock.textContent =
                `Выбрана аудитория: ${foundLocation.room_number}`;

            // Разрешаем оформление заказа
            submitBtn.disabled = false;
            submitBtn.style.background = "#0056b3";
            submitBtn.style.cursor = "pointer";

            console.log("Выбрана локация:", foundLocation);
        });
    });
}

// 3. Модифицируем автозапуск страницы
document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    loadLocations(); // Запуск скачивания локаций
});
