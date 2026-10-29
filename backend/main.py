import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client

# Загружаем .env из папки backend
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "Укажи SUPABASE_URL и SUPABASE_ANON_KEY в файле .env"
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Модель товара в корзине
class CartItem(BaseModel):
    id: int
    quantity: int = Field(gt=0)


# Модель оформления заказа
class OrderCreate(BaseModel):
    user_id: int
    location_id: int
    items: list[CartItem] = Field(min_length=1)


# Получение товаров
@app.get("/api/products")
def get_products():
    try:
        response = (
            supabase.table("products")
            .select("*")
            .execute()
        )
        return response.data

    except Exception as e:
        print(f"Ошибка загрузки товаров: {e}")
        raise HTTPException(
            status_code=500,
            detail="Не удалось загрузить товары"
        )
        
@app.get("/api/locations")
def get_locations():
    try:
        response = (
            supabase.table("delivery_locations")
            .select("id, block, floor, room_number")
            .execute()
        )
        return response.data

    except Exception as e:
        print(f"Ошибка загрузки аудиторий: {e}")
        raise HTTPException(
            status_code=500,
            detail="Не удалось загрузить аудитории"
        )


# Оформление заказа
@app.post("/api/orders")
def create_order(order: OrderCreate):
    try:
        # 1. Подготавливаем товары из корзины
        items = [
            item.model_dump()
            for item in order.items
        ]

        product_ids = list({
            item["id"] for item in items
        })

        # 2. Получаем актуальные цены из Supabase
        products_response = (
            supabase.table("products")
            .select("id, price")
            .in_("id", product_ids)
            .execute()
        )

        products = {
            product["id"]: product["price"]
            for product in products_response.data
        }

        # Проверяем, существуют ли все товары
        if len(products) != len(product_ids):
            raise HTTPException(
                status_code=400,
                detail="Один или несколько товаров не найдены"
            )

        # 3. Списываем остатки через RPC
        supabase.rpc(
            "decrement_stock",
            {"p_items": items}
        ).execute()

        # 4. Создаём запись заказа
        order_response = (
            supabase.table("orders")
            .insert({
                "user_id": order.user_id,
                "location_id": order.location_id,
                "status": "pending"
            })
            .execute()
        )

        if not order_response.data:
            raise HTTPException(
                status_code=500,
                detail="Не удалось создать заказ"
            )

        # Получаем автоматически созданный ID заказа
        order_id = order_response.data[0]["id"]

        # 5. Подготавливаем состав заказа
        order_items = []

        for item in items:
            product_id = item["id"]
            quantity = item["quantity"]

            order_items.append({
                "order_id": order_id,
                "product_id": product_id,
                "quantity": quantity,
                "price_at_purchase": products[product_id]
            })

        # 6. Записываем товары в order_items
        supabase.table("order_items").insert(
            order_items
        ).execute()

        # 7. Возвращаем результат
        return {
            "success": True,
            "order_id": order_id,
            "message": "Заказ успешно оформлен"
        }
        


    except HTTPException:
        raise

    except Exception as e:
        print(f"Ошибка оформления заказа: {e}")

        raise HTTPException(
            status_code=400,
            detail="Не удалось оформить заказ. Проверь данные и остатки товаров."
        )