from auth import verify_password

stored_hash = "$2b$12$OlbfKjqlAk67o.LB4G8XEePL6PyvOYrID7QB9l8GAF53fG4NlBQ3m"

print("admin123 :", verify_password("admin123", stored_hash))
print("Admin123 :", verify_password("Admin123", stored_hash))
print("dev123   :", verify_password("dev123", stored_hash))