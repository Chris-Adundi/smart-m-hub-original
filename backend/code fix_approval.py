from pymongo import MongoClient

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

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