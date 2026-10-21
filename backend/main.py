import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client

# Загрузка .env из папки backend
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


@app.get("/api/products")
def get_products():
    try:
        response = supabase.table("products").select("*").execute()
        return response.data
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Не удалось загрузить товары"
        )


class CartItem(BaseModel):
    id: int
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    user_id: int
    total_amount: float
    items: list[CartItem] = Field(min_length=1)


@app.post("/api/orders")
def create_order(order: OrderCreate):
    try:
        items = [
            item.model_dump()
            for item in order.items
        ]

        supabase.rpc(
            "decrement_stock",
            {"p_items": items}
        ).execute()
        
        supabase.table("orders").insert({
            "user_id": order.user_id,
            "location_id": 1,
            "status": "pending"
        }).execute()

        return {"success": True}

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"He удалось обновить остатки. Проверь наличие товаров.: {str(e)}"
        )
    