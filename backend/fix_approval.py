from pymongo import MongoClient
import os

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "smart_m_hub")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

emails = [
    "admin@demo.com",
    "secretary@demo.com",
    "finance@demo.com",
    "teacher@demo.com",
    "student@demo.com",
    "developer@system.com"
]

# STEP 1: CHECK USERS FIRST
users = db.users.find({"email": {"$in": emails}})

print("\n=== USERS BEFORE UPDATE ===")
for u in users:
    print(u.get("email"), "=>", u.get("approval_status"))

# STEP 2: UPDATE USERS
result = db.users.update_many(
    {"email": {"$in": emails}},
    {
        "$set": {
            "approval_status": "approved",
            "is_active": True,
            "is_suspended": False
        }
    }
)

print("\nUPDATED USERS:", result.modified_count)
