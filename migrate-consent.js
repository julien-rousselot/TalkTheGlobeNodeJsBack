const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const database = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function runConsentMigration() {
  try {
    console.log('Running migration: 002_create_consent_table.sql');
    
    const migrationPath = path.join(__dirname, 'migrations', '002_create_consent_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await database.query(migrationSQL);
    
    console.log('✅ Consent table migration completed successfully');
    await database.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Consent migration failed:', error);
    await database.end();
    process.exit(1);
  }
}

runConsentMigration();
