from pymongo import MongoClient
import os

db = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))[os.getenv("DB_NAME", "smart_m_hub")]

result = db.users.update_many(
    {},
    {"$set": {"school_id": "demo-school-1"}}
)

print("UPDATED:", result.modified_count)

print("DONE ✔")
