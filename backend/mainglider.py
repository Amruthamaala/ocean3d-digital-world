from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path

app = FastAPI(title="Bay of Bengal Glider API")

# Allow your frontend to access the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dataset location
DATA_FILE = Path(__file__).parent / "data" / "bay_of_bengal_glider_depth_profiles_sep2026.json"


@app.get("/")
def root():
    return {
        "message": "Bay of Bengal Glider API is running"
    }


@app.get("/api/glider")
def get_glider_data():
    with open(DATA_FILE, "r", encoding="utf-8") as file:
        data = json.load(file)

    return data