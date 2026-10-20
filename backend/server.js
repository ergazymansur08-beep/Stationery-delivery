const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));


const pool = new Pool({
    user: 'postgres',         
    host: 'localhost',
    database: 'postgres',      
    password: 'postgres',  
    port: 5432,
});


app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка получения товаров' });
    }
});


app.post('/api/orders', async (req, res) => {
    const { user_id, total_amount } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO orders (user_id, total_amount, status, order_date) VALUES ($1, $2, $3, NOW()) RETURNING *',
            [user_id, total_amount, 'pending']
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка создания заказа' });
    }
});

app.listen(3000, () => {
    console.log('Сервер запущен! Открой в браузере: http://localhost:3000');
});