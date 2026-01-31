import { storage } from "./storage";
import { hashPassword } from "./sso";

const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_EMAIL = "admin@library.local";
const DEFAULT_ADMIN_PASSWORD = "admin123";
const DEFAULT_ADMIN_NAME = "System Administrator";

export async function bootstrapSystem(): Promise<void> {
  const log = (message: string) => {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    console.log(`${formattedTime} [bootstrap] ${message}`);
  };

  try {
    const allUsers = await storage.getAllUsers();
    
    if (allUsers.length === 0) {
      log("No users found. Creating default superadmin account...");
      
      const hashedPassword = hashPassword(DEFAULT_ADMIN_PASSWORD);
      
      await storage.createUser({
        username: DEFAULT_ADMIN_USERNAME,
        email: DEFAULT_ADMIN_EMAIL,
        password: hashedPassword,
        name: DEFAULT_ADMIN_NAME,
        category: "STAFF",
        role: "ADMIN",
        status: "ACTIVE",
      });
      
      log("Default superadmin created successfully!");
      log("==============================================");
      log("INITIAL LOGIN CREDENTIALS:");
      log(`  Username: ${DEFAULT_ADMIN_USERNAME}`);
      log(`  Password: ${DEFAULT_ADMIN_PASSWORD}`);
      log("==============================================");
      log("IMPORTANT: Change the default password immediately after first login!");
    }

    const authModeConfig = await storage.getSystemConfig("auth_mode");
    if (!authModeConfig) {
      log("No auth mode config found. Setting default to LOCAL...");
      await storage.setSystemConfig({
        key: "auth_mode",
        value: "LOCAL",
        category: "authentication",
        description: "Authentication mode: LOCAL, ERP, or HYBRID",
      });
      log("Default authentication mode set to LOCAL.");
    }
    
    log("Bootstrap check completed.");
  } catch (error) {
    console.error(`Bootstrap error: ${error}`);
    throw error;
  }
}
