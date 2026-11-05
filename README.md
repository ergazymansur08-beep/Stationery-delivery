# StationeryHub — AITU Delivery System

## Overview
StationeryHub is a web application for ordering stationeries directly to classrooms across floors 1–3 at Astana IT University.

## Requirements & Local Setup
1. Python 3.10+
2. Install dependencies:
   `pip install fastapi uvicorn supabase bcrypt`
3. Run the backend server:
   `python main.py` or `uvicorn main:app --reload`
4. Open `index.html` in your browser.

## Test Accounts (For Evaluation)
* **Student Role:** `student@aitu.kz` / `password123`
* **Admin / Courier Role:** `admin@aitu.kz` / `admin123`
