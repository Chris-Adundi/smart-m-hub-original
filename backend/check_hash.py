from pymongo import MongoClient

db = MongoClient("mongodb://localhost:27017")["test_database"]

user = db.users.find_one({"email": "admin@demo.com"})

print(user["password_hash"] if user else "USER NOT FOUND")
