with open("src/config/env.js", "r", encoding="utf-8") as f:
    content = f.read()

old_str = """  customerDevOtp: process.env.CUSTOMER_DEV_OTP || "123456",
  otpProviderConfigured: Boolean(process.env.OTP_PROVIDER_URL && process.env.OTP_PROVIDER_KEY)
};"""

new_str = """  customerDevOtp: process.env.CUSTOMER_DEV_OTP || "123456",
  otpProviderConfigured: Boolean(process.env.OTP_PROVIDER_URL && process.env.OTP_PROVIDER_KEY),
  googleClientId: process.env.GOOGLE_CLIENT_ID
};"""

if old_str in content:
    content = content.replace(old_str, new_str)
    with open("src/config/env.js", "w", encoding="utf-8") as f:
        f.write(content)
    print("env.js updated")
else:
    print("Could not find old string in env.js")
