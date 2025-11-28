import pool from './mysql.js';
import { initializeDatabase } from './init.js';

async function main() {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('Database initialized successfully!');
    
    // Insert sample data
    const connection = await pool.getConnection();
    
    // Check if sample data already exists
    const [categories] = await connection.execute(
      'SELECT COUNT(*) as count FROM categories'
    );

    if (categories[0].count === 0) {
      console.log('Inserting sample data...');
      
      // Insert sample user
      await connection.execute(`
        INSERT INTO users (name, email, password, phone, city, is_seller)
        VALUES ('Admin User', 'admin@example.com', '$2a$10$abc123', '08123456789', 'Jakarta', TRUE)
      `);

      console.log('Sample data inserted successfully!');
    }
    
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

main();
