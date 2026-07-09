from pymongo import MongoClient
import os

db = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))[os.getenv("DB_NAME", "smart_m_hub")]

user = db.users.find_one({"email": "admin@demo.com"})

print(user["password_hash"] if user else "USER NOT FOUND")
