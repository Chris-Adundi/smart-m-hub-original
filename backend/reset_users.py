from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client["test_database"]

result = db.users.delete_many({})

print("USERS DELETED:", result.deleted_count)