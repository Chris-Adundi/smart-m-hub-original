import asyncio
from server import db

async def main():
    schools = await db.schools.find(
        {},
        {
            "_id": 0,
            "id": 1,
            "name": 1,
            "school_code": 1,
            "login_link": 1,
            "invite_code": 1,
        },
    ).to_list(None)

    print("\nREGISTERED SCHOOLS\n")

    for school in schools:
        print("-" * 70)
        print(school)

asyncio.run(main())