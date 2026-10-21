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
        const card = document.createElement("div");
        card.className = "product-card";
        card.innerHTML = `
            <h3>${product.name}</h3>
            <p>${product.description || ''}</p>
            <p><strong>Категория:</strong> ${product.category || 'Общее'}</p>
            <p><strong>В наличии:</strong> ${product.stock_quantity} шт.</p>
            <p class="price" style="font-weight: bold; color: #0056b3;">₸ ${product.price}</p>
            <button onclick="addToCart(${product.id}, '${product.name}', ${product.price})" style="cursor: pointer; padding: 5px 10px;">+ В корзину</button>
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
    renderCart(); // Сразу перерисовываем корзину на экране
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

    // Автоматически подставляем общую сумму в инпут формы заказа
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

    if (cart.length === 0) {
        alert("Корзина пуста! Добавьте товары перед оформлением заказа.");
        return;
    }

    const userId = document.querySelector('input[name="user_id"]').value;
    const totalAmount = document.querySelector('input[name="total_amount"]').value;

    const payload = {
        user_id: parseInt(userId, 10),
        total_amount: parseFloat(totalAmount),
        items: cart.map(item => ({
            id: item.id,
            quantity: item.quantity
        }))
    };

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Покупка оформлена! Остатки обновлены в Supabase.");

            cart = [];
            renderCart();

            // Загружаем товары с актуальными остатками
            await loadProducts();
        } else {
            const err = await response.json();
            alert(
                "Ошибка при оформлении заказа: " +
                (err.detail || "Неизвестная ошибка")
            );
        }
    } catch (error) {
        console.error("Ошибка сети:", error);
        alert("Не удалось отправить заказ на сервер.");
    }
}

// Автозапуск при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
});