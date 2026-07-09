from pymongo import MongoClient
import os

client = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))
db = client[os.getenv("DB_NAME", "smart_m_hub")]

result = db.users.delete_many({})

print("USERS DELETED:", result.deleted_count)
