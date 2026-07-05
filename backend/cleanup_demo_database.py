import asyncio
from server import db

KEEP_SCHOOL_CODE = "SMH-KE-000001"

async def main():
    # Find the school to keep
    school = await db.schools.find_one({"school_code": KEEP_SCHOOL_CODE})

    if not school:
        print(f"School with code {KEEP_SCHOOL_CODE} not found.")
        return

    keep_id = school["id"]

    print("Keeping school:")
    print(f"  Name: {school.get('name')}")
    print(f"  ID: {keep_id}")
    print(f"  Code: {KEEP_SCHOOL_CODE}")

    # Delete all other schools
    result = await db.schools.delete_many({"id": {"$ne": keep_id}})
    print(f"\nDeleted {result.deleted_count} schools.")

    # Update demo users
    demo_emails = [
        "admin@demo.com",
        "secretary@demo.com",
        "finance@demo.com",
        "teacher@demo.com",
        "student@demo.com",
    ]

    result = await db.users.update_many(
        {"email": {"$in": demo_emails}},
        {"$set": {"school_id": keep_id}}
    )

    print(f"Updated {result.modified_count} demo users.")

    # Rename the school if it still has the placeholder name
    await db.schools.update_one(
        {"id": keep_id},
        {
            "$set": {
                "name": "Smart M Hub Demo School"
            }
        }
    )

    print("\nCleanup complete.")

asyncio.run(main())