with open("src/routes/customer-auth.routes.js", "r", encoding="utf-8") as f:
    content = f.read()

if "googleSession" not in content:
    content = content.replace(
        "import { externalSession } from \"../controllers/customer-auth.controller.js\";",
        "import { externalSession, googleSession } from \"../controllers/customer-auth.controller.js\";"
    )
    content = content.replace(
        "router.post(\"/session\", externalSession);",
        "router.post(\"/session\", externalSession);\nrouter.post(\"/session/google\", googleSession);"
    )
    with open("src/routes/customer-auth.routes.js", "w", encoding="utf-8") as f:
        f.write(content)
    print("customer-auth.routes.js updated")
else:
    print("googleSession already in routes")
