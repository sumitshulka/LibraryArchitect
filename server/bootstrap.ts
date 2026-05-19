import { storage } from "./storage";
import { hashPassword } from "./sso";
import { ensureInitialCirculationPolicyVersion } from "./fines";

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
    
    const auditCategories = [
      { key: 'audit.AUTHENTICATION', label: 'Authentication events', defaultOn: true },
      { key: 'audit.USER_MANAGEMENT', label: 'User management', defaultOn: true },
      { key: 'audit.CATALOG', label: 'Catalog changes', defaultOn: true },
      { key: 'audit.CIRCULATION', label: 'Circulation events', defaultOn: true },
      { key: 'audit.FINES', label: 'Fine operations', defaultOn: true },
      { key: 'audit.INVENTORY', label: 'Inventory audits', defaultOn: true },
      { key: 'audit.REPORTS', label: 'Report generation', defaultOn: true },
      { key: 'audit.ERP_INTEGRATION', label: 'ERP integration events', defaultOn: true },
      { key: 'audit.SYSTEM_CONFIG', label: 'System config changes', defaultOn: true },
      { key: 'audit.STAFF_ALLOCATION', label: 'Staff allocation', defaultOn: true },
      { key: 'audit.API_ACCESS', label: 'All API request logging', defaultOn: false },
    ];

    for (const cat of auditCategories) {
      const existing = await storage.getSystemConfig(cat.key);
      if (!existing) {
        await storage.setSystemConfig({
          key: cat.key,
          value: cat.defaultOn ? 'true' : 'false',
          category: 'audit',
          description: cat.label,
        });
      }
    }
    log("Audit logging configuration initialized.");

    const catalogLimit = await storage.getSystemConfig("erp_catalog_limit");
    if (!catalogLimit) {
      await storage.setSystemConfig({
        key: "erp_catalog_limit",
        value: "50",
        category: "catalog",
        description: "Maximum number of books returned in ERP catalog search before requiring refinement",
      });
      log("ERP catalog limit set to default (50).");
    }

    await ensureInitialCirculationPolicyVersion();
    log("Bootstrap check completed.");
  } catch (error) {
    console.error(`Bootstrap error: ${error}`);
    throw error;
  }
}
