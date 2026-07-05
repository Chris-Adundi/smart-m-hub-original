from pymongo import MongoClient
from auth import hash_password   # ✅ IMPORTANT: use backend logic

client = MongoClient("mongodb://localhost:27017")
db = client["test_database"]

users = [
    ("admin@demo.com", "admin123", "school_admin"),
    ("secretary@demo.com", "secretary123", "secretary"),
    ("finance@demo.com", "finance123", "finance"),
    ("teacher@demo.com", "teacher123", "teacher"),
    ("student@demo.com", "student123", "student"),
    ("developer@system.com", "dev123", "super_admin"),
]

for email, password, role in users:
    db.users.insert_one({
        "email": email,
        "password_hash": hash_password(password),  # ✅ matches backend
        "role": role,
        "approval_status": "approved",
        "is_active": True,
        "is_suspended": False
    })

print("DONE: demo users seeded")