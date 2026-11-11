import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import bcrypt
from pydantic import BaseModel, Field
from supabase import create_client, Client

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

# Ваши ключи Supabase
SUPABASE_URL = "https://cyogeqswcxkwwztovqqw.supabase.co"
SUPABASE_KEY = "sb_publishable_Ljx4nNjQIwUA18De7qhQhA_oT8wsi4R"

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Укажи SUPABASE_URL и SUPABASE_ANON_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="StationeryHub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешает запросы с любых доменов (включая Vercel)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CartItem(BaseModel):
    id: int
    quantity: int = Field(gt=0)

class OrderCreate(BaseModel):
    user_id: int
    location_id: int
    items: list[CartItem] = Field(min_length=1)

class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: str
    password: str

class StatusUpdate(BaseModel):
    status: str

@app.post("/api/register")
def register_user(user: UserRegister):
    try:
        existing = supabase.table("users").select("*").eq("email", user.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Пользователь с таким email уже зарегистрирован")
        
        pwd_bytes = user.password.encode("utf-8")[:72]
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")
        
        response = supabase.table("users").insert({
            "email": user.email,
            "password_hash": hashed_password,
            "full_name": user.full_name,
            "role": "student"
        }).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Ошибка регистрации в базе")
            
        return {"message": "Успешная регистрация", "user": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Критическая ошибка регистрации: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

@app.post("/api/login")
def login_user(user: UserLogin):
    try:
        # Корректный запрос через .table("users") без ошибок путей PostgREST
        response = supabase.table("users").select("*").eq("email", user.email).execute()
        
        user_data = response.data
        if not user_data or len(user_data) == 0:
            raise HTTPException(status_code=401, detail="Пользователь с таким email не найден")
            
        db_user = user_data[0]
        stored_hash = db_user.get("password_hash")
        
        if not stored_hash:
            raise HTTPException(status_code=401, detail="Пароль не задан")
            
        pwd_bytes = user.password.encode("utf-8")[:72]
        
        if not bcrypt.checkpw(pwd_bytes, stored_hash.encode("utf-8")):
            raise HTTPException(status_code=401, detail="Неверный пароль")
            
        return {
            "message": "Успешный вход",
            "user_id": db_user["id"],
            "email": db_user["email"],
            "full_name": db_user.get("full_name", "User"),
            "role": db_user.get("role", "student"),
            "access_token": f"token-{db_user['id']}"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Критическая ошибка входа: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

@app.get("/api/products")
def get_products():
    try:
        response = supabase.table("products").select("*").execute()
        return response.data
    except Exception as e:
        print(f"Ошибка загрузки товаров: {e}")
        raise HTTPException(status_code=500, detail="Не удалось загрузить товары")

@app.get("/api/locations")
def get_locations():
    try:
        response = supabase.table("delivery_locations").select("id, block, floor, room_number").execute()
        return response.data
    except Exception as e:
        print(f"Ошибка загрузки аудиторий: {e}")
        raise HTTPException(status_code=500, detail="Не удалось загрузить аудитории")

@app.post("/api/orders")
def create_order(order: OrderCreate):
    try:
        items = [item.model_dump() for item in order.items]
        product_ids = list({item["id"] for item in items})

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

        if len(products) != len(product_ids):
            raise HTTPException(status_code=400, detail="Один или несколько товаров не найдены")

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
            raise HTTPException(status_code=500, detail="Не удалось создать заказ")

        order_id = order_response.data[0]["id"]
        order_items = []

        for item in items:
            prod_id = item["id"]
            quantity = item["quantity"]
            order_items.append({
                "order_id": order_id,
                "product_id": prod_id,
                "quantity": quantity,
                "price_at_purchase": products[prod_id]
            })

        supabase.table("order_items").insert(order_items).execute()

        return {
            "success": True,
            "order_id": order_id,
            "message": "Заказ успешно оформлен"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка оформления заказа: {e}")
        raise HTTPException(status_code=400, detail=f"Не удалось оформить заказ: {str(e)}")

@app.get("/api/orders")
def get_orders():
    try:
        orders_response = supabase.table("orders").select("*").execute()
        orders = orders_response.data
        
        for order in orders:
            items_response = supabase.table("order_items") \
                .select("quantity, price_at_purchase, product_id, products(name)") \
                .eq("order_id", order["id"]) \
                .execute()
            
            formatted_items = []
            if items_response.data:
                for item in items_response.data:
                    prod_info = item.get("products")
                    prod_name = "Товар"
                    if isinstance(prod_info, dict):
                        prod_name = prod_info.get("name", "Товар")
                    elif isinstance(prod_info, list) and len(prod_info) > 0:
                        prod_name = prod_info[0].get("name", "Товар")
                        
                    formatted_items.append({
                        "product_name": prod_name,
                        "quantity": item.get("quantity", 1),
                        "price_at_purchase": item.get("price_at_purchase", 0)
                    })
            
            order["items"] = formatted_items
            
        return orders
    except Exception as e:
        print(f"Ошибка в get_orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/orders/{order_id}/status")
def update_order_status(order_id: int, payload: StatusUpdate):
    try:
        supabase.table("orders").update({"status": payload.status}).eq("id", order_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
