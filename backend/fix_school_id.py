from pymongo import MongoClient

db = MongoClient("mongodb://localhost:27017")["test_database"]

result = db.users.update_many(
    {},
    {"$set": {"school_id": "demo-school-1"}}
)

print("UPDATED:", result.modified_count)

print("DONE ✔")
