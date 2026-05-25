import bcrypt from "bcryptjs";

const password = "YOUR_ADMIN_PASSWORD";

const hash = await bcrypt.hash(password, 10);

console.log(hash);
