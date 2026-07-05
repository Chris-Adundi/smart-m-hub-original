import asyncio
from server import db

async def main():
    users = await db.users.find(
        {},
        {
            "_id": 0,
            "email": 1,
            "role": 1,
            "password_hash": 1,
            "hashed_password": 1,
        },
    ).to_list(None)

    for user in users:
        print("-" * 60)
        print(user)

asyncio.run(main())