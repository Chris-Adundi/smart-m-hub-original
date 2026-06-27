from pymongo import MongoClient
from auth import hash_password

client = MongoClient("mongodb://localhost:27017")
db = client["test_database"]

users = [
    {"email": "admin@demo.com", "password": "admin123", "role": "school_admin"},
    {"email": "secretary@demo.com", "password": "secretary123", "role": "secretary"},
    {"email": "finance@demo.com", "password": "finance123", "role": "finance"},
    {"email": "teacher@demo.com", "password": "teacher123", "role": "teacher"},
    {"email": "student@demo.com", "password": "student123", "role": "student"},
    {"email": "developer@system.com", "password": "dev123", "role": "super_admin"},
]

for u in users:
    db.users.update_one(
        {"email": u["email"]},
        {
            "$set": {
                "email": u["email"],
                "password_hash": hash_password(u["password"]),
                "role": u["role"],
                "approval_status": "approved",
                "is_active": True,
                "is_suspended": False
            }
        },
        upsert=True
    )

print("DONE: demo users seeded")