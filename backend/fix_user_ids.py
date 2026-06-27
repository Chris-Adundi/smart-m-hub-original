from pymongo import MongoClient
import uuid

client = MongoClient("mongodb://localhost:27017")
db = client["test_database"]

users = db.users.find()

updated = 0

for user in users:
    if "id" not in user or not user["id"]:
        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"id": str(uuid.uuid4())}}
        )
        updated += 1

print("UPDATED USERS:", updated)