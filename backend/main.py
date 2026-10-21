import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client

from pathlib import Path
from dotenv import load_dotenv

# Явно указываем путь к .env файлу внутри папки backend
env_path = Path(__file__).resolve().parent / '.env'
load_dotenv(dotenv_path=env_path)


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/products")
def get_products():
    response = supabase.table("products").select("*").execute()
    return response.data
from pydantic import BaseModel

# Описываем структуру данных, которую ждем от сайта
class OrderCreate(BaseModel):
    user_id: int
    total_amount: float

# Создаем маршрут для сохранения заказа в таблицу orders
@app.post("/api/orders")
def create_order(order: OrderCreate):
    try:
        response = supabase.table("orders").insert({
            "user_id": order.user_id,
            "total_amount": order.total_amount
        }).execute()
        return {"success": True, "data": response.data}
    except Exception as e:
        return {"error": str(e)}