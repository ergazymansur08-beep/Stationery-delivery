// Адрес твоего FastAPI бэкенда
const API_URL = "http://127.0.0.1:8000/api";

let allProducts = [];
let cart = []; // Массив для корзины

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
        let imageUrl = "https://cdn-icons-png.flaticon.com/512/2543/2543279.png"; // Дефолт
        
        const productName = (product.name || "").toLowerCase();

        if (productName.includes("notebook")) {
            imageUrl = "https://cdn-icons-png.flaticon.com/512/3388/3388722.png";
        } else if (productName.includes("pen")) {
            imageUrl = "https://cdn-icons-png.flaticon.com/512/1250/1250615.png";
        } else if (productName.includes("marker")) {
            imageUrl = "https://cdn-icons-png.flaticon.com/512/2921/2921222.png";
        }

        const card = document.createElement("div");
        card.className = "product-card";
        card.innerHTML = `
            <div class="product-img-container">
                <img src="${imageUrl}" alt="${product.name}">
            </div>
            <h3>${product.name}</h3>
            <p>${product.description || ''}</p>
            <p><strong>Категория:</strong> ${product.category || 'Общее'}</p>
            <p><strong>В наличии:</strong> ${product.stock_quantity} шт.</p>
            <p class="price" style="font-weight: bold; color: #0056b3;">₸ ${product.price}</p>
            <button class="btn-add" onclick="addToCart(${product.id}, '${product.name}', ${product.price})">+ В корзину</button>
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
function addToCart(id, name, price) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    renderCart();
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
            <li style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 6px;">
                <span><strong>${item.name}</strong> — ₸ ${item.price} × ${item.quantity} = <strong>₸ ${itemTotal}</strong></span>
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

// 9. Загрузка локаций доставки из базы данных в выпадающий список
async function loadDeliveryLocations() {
    try {
        let response = await fetch(`${API_URL}/delivery-locations`);
        let locations = await response.json();

        const select = document.getElementById("locationSelect");
        if (!select) return;
        
        select.innerHTML = "";

        locations.forEach(loc => {
            const option = document.createElement("option");
            option.value = loc.id; // ID из таблицы delivery_locations
            option.textContent = `Корпус ${loc.block} | Кабинет ${loc.room_number}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Ошибка загрузки локаций:", error);
    }
}

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    loadDeliveryLocations();
});

// 10. ФУНКЦИЯ ОТПРАВКИ ЗАКАЗА
async function submitOrder(event) {
    if (event) event.preventDefault(); // Предотвращаем перезагрузку страницы, если вызов из формы

    const statusMsg = document.getElementById("order-status-msg");
    if (statusMsg) statusMsg.textContent = "";

    const userIdInput = document.querySelector('input[name="user_id"]');
    const totalAmountInput = document.querySelector('input[name="total_amount"]');
    const locationSelect = document.getElementById("locationSelect");

    const userId = userIdInput ? parseInt(userIdInput.value) : 1;
    
    // Считаем сумму прямо из корзины для абсолютной точности
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Считываем реальный ID выбранного кабинета (число)
    const locationId = locationSelect && locationSelect.value ? parseInt(locationSelect.value) : 1;

    // Проверка корзины
    if (cart.length === 0) {
        if (statusMsg) {
            statusMsg.style.color = "red";
            statusMsg.textContent = "✖ Корзина пуста! Добавьте товары перед заказом.";
        }
        return;
    }

    try {
        // Подготавливаем товары строго по схеме бэкенда (id и quantity)
        const orderPayload = {
            user_id: userId,
            total_amount: totalAmount,
            location_id: locationId, // Передаем выбранный ID локации кабинета
            items: cart.map(item => ({
                id: item.id,
                quantity: item.quantity
            }))
        };

        let response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });

        let result = await response.json().catch(() => ({}));

        if (response.ok) {
            if (statusMsg) {
                statusMsg.style.color = "green";
                statusMsg.textContent = "✔ Заказ успешно сохранен!";
            }
            cart = [];
            renderCart();
        } else {
            let errorDetail = result.detail;
            let errorText = typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : (errorDetail || "Не удалось оформить заказ!");
            if (statusMsg) {
                statusMsg.style.color = "red";
                statusMsg.textContent = "✖ Ошибка: " + errorText;
            }
        }

    } catch (error) {
        console.error("Ошибка связи с сервером:", error);
        if (statusMsg) {
            statusMsg.style.color = "red";
            statusMsg.textContent = "✖ Ошибка соединения с сервером!";
        }
    }
}