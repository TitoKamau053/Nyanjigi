const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();



class MigrationTool {
  constructor() {
  this.dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };


    this.connection = null;
    this.migrationsDir = path.join(process.cwd(), "scripts", "migrations");
  }

  async connect() {
    this.connection = await mysql.createConnection(this.dbConfig);
    console.log("✅ Database connected successfully");
  }

  async executeQuery(query, params = []) {
    const [rows] = await this.connection.execute(query, params);
    return rows;
  }

  async runMigrations() {
    console.log("📦 Running database migrations...");

    if (!fs.existsSync(this.migrationsDir)) {
      console.log("ℹ️ No migrations directory found, skipping...");
      return;
    }

    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("ℹ️ No migration files found");
      return;
    }

    for (const file of files) {
      const filePath = path.join(this.migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf8");
      await this.connection.query(sql);
      console.log(`✅ Applied migration: ${file}`);
    }
  }

  async seedDatabase() {
    console.log("🌱 Seeding database...");

    const adminExists = await this.executeQuery(
      "SELECT id FROM admins LIMIT 1"
    );

    if (adminExists.length === 0) {
      const hashedPassword = await bcrypt.hash("Admin@2025", 12);
      await this.executeQuery(
        "INSERT INTO admins (username, email, password_hash, full_name) VALUES ('admin','admin@nyanjigi.co.ke', ?, 'System Administrator')",
        [hashedPassword]
      );
      console.log(
        "👤 Default admin user created (username: admin, password: Admin@2025)"
      );
    } else {
      console.log("ℹ️ Admin already exists, skipping seeding");
    }

    console.log("✅ Seeding completed");
  }

  async run() {
    try {
      console.log("🚀 Database Migration Tool");
      console.log("==================================================");

      await this.connect();
      await this.runMigrations();
      await this.seedDatabase();

      console.log("✅ Migration completed successfully");
      await this.connection.end();
    } catch (err) {
      console.error("❌ Migration failed:", err);
      process.exit(1);
    }
  }
}

const tool = new MigrationTool();
tool.run();
