let allProducts = [];
let cart = new Map();

// Функция для подбора твоих картинок по URL
function getProductImage(name) {
    const n = name ? name.toLowerCase() : '';
    
    if (n.includes('карандаш') || n.includes('pencil')) {
        // Иконка карандаша
        return 'https://img.joomcdn.net/41909404ed567bf8e6e532b2240414a6c9752b79_original.jpeg';
    } else if (n.includes('ручк') || n.includes('pen')) {
        // Иконка ручки
        return 'https://cross.com/cdn/shop/files/mi2femkmad3vf8btbm21_2_4.jpg?v=1718633099&width=1445';
    } else if (n.includes('тетрад') || n.includes('бумаг') || n.includes('notebook')) {
        // Иконка тетради
        return 'https://images.satu.kz/111622873_w640_h640_bloknot-a5-ribby.jpg';
    } else {
        // Универсальная иконка для остальных товаров
        return 'https://cdn-icons-png.flaticon.com/512/1041/1041916.png';
    }
}

// Загрузка товаров из базы данных PostgreSQL через сервер
async function loadProducts() {
    try {
        const response = await fetch('http://localhost:3000/api/products');
        if (!response.ok) throw new Error('Ошибка сети');
        const data = await response.json();

        // Убираем дубликаты по имени товара
        const map = new Map();
        data.forEach(item => {
            if (item.name) {
                const cleanName = item.name.trim().toLowerCase();
                if (!map.has(cleanName)) {
                    map.set(cleanName, item);
                }
            }
        });
        allProducts = Array.from(map.values());

        displayProducts(allProducts);
        populateFilterDropdown(allProducts);
    } catch (err) {
        console.error('Ошибка загрузки:', err);
        document.getElementById('productsGrid').innerHTML = '<p style="color: red;">Не удалось загрузить товары с сервера. Проверьте, запущен ли node server.js</p>';
    }
}

// Отрисовка карточек товаров
function displayProducts(products) {
    const grid = document.getElementById('productsGrid');
    if (!products || products.length === 0) {
        grid.innerHTML = '<p>Товары не найдены</p>';
        return;
    }

    grid.innerHTML = products.map((p) => {
        const imgSrc = getProductImage(p.name);
        const realIndex = allProducts.findIndex(item => item.name === p.name);
        return `
            <div class="product-card">
                <div class="product-img-container">
                    <img src="${imgSrc}" alt="${p.name}">
                </div>
                <h3>${p.name}</h3>
                <div class="price">₸ ${Number(p.price || 0).toFixed(0)}</div>
                <button class="btn-add" data-index="${realIndex}">+ В корзину</button>
            </div>
        `;
    }).join('');

    // Привязываем клики на кнопки добавления
    grid.querySelectorAll('.btn-add').forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'), 10);
            addToCartByIndex(index, this);
        });
    });
}

// Заполнение выпадающего списка фильтра
function populateFilterDropdown(products) {
    const select = document.getElementById('productFilter');
    if (!select) return;
    
    select.innerHTML = '<option value="all">Все товары (Показать всё)</option>';
    
    products.forEach((p, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `Товар ${index + 1}: ${p.name}`;
        select.appendChild(option);
    });
}

// Обработка выбора товара в выпадающем списке (показ строго по одному)
const filterSelect = document.getElementById('productFilter');
if (filterSelect) {
    filterSelect.addEventListener('change', function() {
        const val = this.value;
        if (val === 'all') {
            displayProducts(allProducts);
        } else {
            const idx = parseInt(val, 10);
            if (!isNaN(idx) && allProducts[idx]) {
                displayProducts([allProducts[idx]]);
            }
        }
    });
}

// Добавление товара в корзину с визуальным эффектом на кнопке
function addToCartByIndex(index, buttonElement) {
    const product = allProducts[index];
    if (!product) return;

    if (cart.has(product.name)) {
        const item = cart.get(product.name);
        item.qty += 1;
    } else {
        cart.set(product.name, { product, qty: 1 });
    }

    renderCart();

    if (buttonElement) {
        const originalText = buttonElement.textContent;
        buttonElement.textContent = "Добавлено! ✓";
        buttonElement.style.background = "#38a169";
        setTimeout(() => {
            buttonElement.textContent = originalText;
            buttonElement.style.background = "";
        }, 1000);
    }
}

// Удаление товара из корзины
function removeFromCart(productName) {
    cart.delete(productName);
    renderCart();
}

// Рендер корзины и подсчет суммы
function renderCart() {
    const cartContainer = document.getElementById('cartItems');
    const totalEl = document.getElementById('totalAmount');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (!cartContainer || !totalEl || !checkoutBtn) return;

    if (cart.size === 0) {
        cartContainer.innerHTML = '<p class="empty-cart-msg">Корзина пуста. Нажмите «+ В корзину» на товарах выше.</p>';
        totalEl.textContent = '₸ 0';
        checkoutBtn.disabled = true;
        return;
    }

    let total = 0;
    cartContainer.innerHTML = '';

    cart.forEach((item, name) => {
        const itemTotal = (item.product.price || 0) * item.qty;
        total += itemTotal;
        const imgSrc = getProductImage(item.product.name);

        const card = document.createElement('div');
        card.className = 'cart-item-card';
        card.innerHTML = `
            <span class="remove-btn" data-name="${name}">✕</span>
            <img src="${imgSrc}" alt="${name}">
            <div class="name">${item.product.name}</div>
            <div class="qty">${item.qty} шт.</div>
        `;
        cartContainer.appendChild(card);
    });

    cartContainer.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const name = this.getAttribute('data-name');
            removeFromCart(name);
        });
    });

    totalEl.textContent = `₸ ${total.toLocaleString()}`;
    checkoutBtn.disabled = false;
}

// Отправка заказа (INSERT) в базу данных PostgreSQL через сервер
const orderForm = document.getElementById('orderForm');
if (orderForm) {
    orderForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (cart.size === 0) return;

        let totalSum = 0;
        cart.forEach(item => totalSum += (item.product.price || 0) * item.qty);

        const userIdInput = document.getElementById('userIdInput');
        const userId = userIdInput ? userIdInput.value : 1;

        try {
            const response = await fetch('http://localhost:3000/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: parseInt(userId, 10), total_amount: totalSum })
            });

            if (response.ok) {
                alert('Успешно! Заказ оформлен и записан в PostgreSQL.');
                cart.clear();
                renderCart();
            } else {
                alert('Ошибка сервера при добавлении заказа.');
            }
        } catch (err) {
            alert('Не удалось связаться с сервером.');
        }
    });
}

// Запускаем загрузку при старте страницы
loadProducts();