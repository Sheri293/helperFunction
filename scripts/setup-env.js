import fs from "fs";

const envContent = `NODE_ENV=test
BASE_URL=http://localhost:3001
TEST_PORT=3001
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=ssheheryar12@gmail.com    
EMAIL_PASS=izpp vkis flsr srkr
EMAIL_RECIPIENTS=sheheryar@pursue.today,shifa@pursue.today`;

if (!fs.existsSync(".env")) {
  fs.writeFileSync(".env", envContent);
  console.log(" Created .env file");
} else {
  console.log(" .env file already exists");
}
