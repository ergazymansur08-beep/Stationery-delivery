import os
import time
from pathlib import Path

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import Client, create_client

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]
JWT_SECRET = os.environ["JWT_SECRET"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="StationeryHub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_ROLES = ("admin", "administrator")
ALLOWED_STATUSES = {"pending", "Delivered", "completed", "cancelled"}


def make_token(user: dict) -> str:
    return jwt.encode(
        {
            "sub": str(user["id"]),
            "role": user.get("role", "student"),
            "exp": int(time.time()) + 8 * 3600,
        },
        JWT_SECRET,
        algorithm="HS256",
    )


def current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Нужен вход")
    try:
        data = jwt.decode(authorization[7:], JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Недействительный токен")
    return {"id": int(data["sub"]), "role": str(data["role"]).lower()}


def admin_only(user=Depends(current_user)):
    if user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Только для администратора")
    return user


class CartItem(BaseModel):
    id: int
    quantity: int = Field(gt=0, le=100)


class OrderCreate(BaseModel):
    location_id: int
    items: list[CartItem] = Field(min_length=1)


class UserRegister(BaseModel):
    email: str = Field(max_length=200)
    password: str = Field(min_length=6, max_length=72)
    full_name: str = Field(max_length=100)


class UserLogin(BaseModel):
    email: str
    password: str


class StatusUpdate(BaseModel):
    status: str

class StockUpdate(BaseModel):
    stock_quantity: int = Field(ge=0, le=100000)


@app.post("/api/register")
def register_user(user: UserRegister):
    try:
        existing = supabase.table("users").select("id").eq("email", user.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Пользователь с таким email уже зарегистрирован")

        pwd_bytes = user.password.encode("utf-8")[:72]
        hashed_password = bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")

        response = supabase.table("users").insert({
            "email": user.email,
            "password_hash": hashed_password,
            "full_name": user.full_name,
            "role": "student",
        }).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Ошибка регистрации в базе")

        return {"message": "Успешная регистрация"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка регистрации: {e}")
        raise HTTPException(status_code=500, detail="Ошибка сервера")


@app.post("/api/login")
def login_user(user: UserLogin):
    try:
        response = supabase.table("users").select("*").eq("email", user.email).execute()
        if not response.data:
            raise HTTPException(status_code=401, detail="Неверный email или пароль")

        db_user = response.data[0]
        stored_hash = db_user.get("password_hash")
        if not stored_hash:
            raise HTTPException(status_code=401, detail="Неверный email или пароль")

        pwd_bytes = user.password.encode("utf-8")[:72]
        if not bcrypt.checkpw(pwd_bytes, stored_hash.encode("utf-8")):
            raise HTTPException(status_code=401, detail="Неверный email или пароль")

        return {
            "message": "Успешный вход",
            "user_id": db_user["id"],
            "email": db_user["email"],
            "full_name": db_user.get("full_name", "User"),
            "role": db_user.get("role", "student"),
            "access_token": make_token(db_user),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка входа: {e}")
        raise HTTPException(status_code=500, detail="Ошибка сервера")


@app.get("/api/products")
def get_products():
    try:
        return supabase.table("products").select("*").execute().data
    except Exception as e:
        print(f"Ошибка загрузки товаров: {e}")
        raise HTTPException(status_code=500, detail="Не удалось загрузить товары")


@app.get("/api/locations")
def get_locations():
    try:
        return supabase.table("delivery_locations").select("id, block, floor, room_number").execute().data
    except Exception as e:
        print(f"Ошибка загрузки аудиторий: {e}")
        raise HTTPException(status_code=500, detail="Не удалось загрузить аудитории")


@app.post("/api/orders")
def create_order(order: OrderCreate, user=Depends(current_user)):
    try:
        items = [item.model_dump() for item in order.items]
        product_ids = list({item["id"] for item in items})

        products_response = (
            supabase.table("products")
            .select("id, price")
            .in_("id", product_ids)
            .execute()
        )
        products = {p["id"]: p["price"] for p in products_response.data}

        if len(products) != len(product_ids):
            raise HTTPException(status_code=400, detail="Один или несколько товаров не найдены")

        order_response = (
            supabase.table("orders")
            .insert({
                "user_id": user["id"],
                "location_id": order.location_id,
                "status": "pending",
            })
            .execute()
        )
        if not order_response.data:
            raise HTTPException(status_code=500, detail="Не удалось создать заказ")

        order_id = order_response.data[0]["id"]
        order_items = [
            {
                "order_id": order_id,
                "product_id": item["id"],
                "quantity": item["quantity"],
                "price_at_purchase": products[item["id"]],
            }
            for item in items
        ]
        supabase.table("order_items").insert(order_items).execute()

        return {"success": True, "order_id": order_id, "message": "Заказ успешно оформлен"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка оформления заказа: {e}")
        raise HTTPException(status_code=400, detail="Не удалось оформить заказ")


@app.get("/api/orders")
def get_orders(user=Depends(admin_only)):
    try:
        orders = supabase.table("orders").select("*").execute().data

        for order in orders:
            items_response = (
                supabase.table("order_items")
                .select("quantity, price_at_purchase, product_id, products(name)")
                .eq("order_id", order["id"])
                .execute()
            )

            formatted_items = []
            for item in items_response.data or []:
                prod_info = item.get("products")
                prod_name = "Товар"
                if isinstance(prod_info, dict):
                    prod_name = prod_info.get("name", "Товар")
                elif isinstance(prod_info, list) and prod_info:
                    prod_name = prod_info[0].get("name", "Товар")

                formatted_items.append({
                    "product_name": prod_name,
                    "quantity": item.get("quantity", 1),
                    "price_at_purchase": item.get("price_at_purchase", 0),
                })

            order["items"] = formatted_items

        return orders
    except Exception as e:
        print(f"Ошибка в get_orders: {e}")
        raise HTTPException(status_code=500, detail="Ошибка сервера")


@app.patch("/api/orders/{order_id}/status")
def update_order_status(order_id: int, payload: StatusUpdate, user=Depends(admin_only)):
    if payload.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Недопустимый статус")
    try:
        supabase.table("orders").update({"status": payload.status}).eq("id", order_id).execute()
        return {"success": True}
    except Exception as e:
        print(f"Ошибка смены статуса: {e}")
        raise HTTPException(status_code=500, detail="Ошибка сервера")

@app.patch("/api/products/{product_id}/stock")
def update_stock(product_id: int, payload: StockUpdate, user=Depends(admin_only)):
    try:
        result = (
            supabase.table("products")
            .update({"stock_quantity": payload.stock_quantity})
            .eq("id", product_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Товар не найден")
        return {"success": True, "stock_quantity": result.data[0]["stock_quantity"]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка смены остатка: {e}")
        raise HTTPException(status_code=500, detail="Ошибка сервера")
