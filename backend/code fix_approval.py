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
    "student@demo.com"
]

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

print("UPDATED USERS:", result.modified_count)
