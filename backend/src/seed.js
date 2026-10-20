import bcrypt from 'bcryptjs';
import pool from './db.js';

const demoPassword = 'StoreDemo1!';
const users = [
  { name: 'System Administrator Account', email: 'admin@storerating.local', address: '100 Admin Avenue, Central District', role: 'admin' },
  { name: 'Sample Store Owner Account', email: 'owner@storerating.local', address: '25 Market Street, North District', role: 'store_owner' },
  { name: 'Sample Customer Account', email: 'user@storerating.local', address: '42 Garden Road, West District', role: 'user' }
];

try {
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const ids = {};
    for (const user of users) {
      const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [user.email]);
      if (existing.length) {
        ids[user.email] = existing[0].id;
        console.log(`Kept existing account: ${user.email}`);
      } else {
        const [created] = await connection.execute(
          'INSERT INTO users (name, email, address, password_hash, role) VALUES (?, ?, ?, ?, ?)',
          [user.name, user.email, user.address, passwordHash, user.role]
        );
        ids[user.email] = created.insertId;
        console.log(`Created demo account: ${user.email}`);
      }
    }
    const [existingStore] = await connection.execute('SELECT id FROM stores WHERE email = ?', ['hello@harborbooks.local']);
    let storeId = existingStore[0]?.id;
    if (!storeId) {
      const [createdStore] = await connection.execute(
        'INSERT INTO stores (name, email, address, owner_id) VALUES (?, ?, ?, ?)',
        ['Harbor Books & Stationery', 'hello@harborbooks.local', '25 Market Street, North District', ids['owner@storerating.local']]
      );
      storeId = createdStore.insertId;
      console.log('Created demo store: Harbor Books & Stationery');
    } else {
      console.log('Kept existing demo store: hello@harborbooks.local');
    }
    const [existingRating] = await connection.execute(
      'SELECT id FROM ratings WHERE user_id = ? AND store_id = ?',
      [ids['user@storerating.local'], storeId]
    );
    if (!existingRating.length) {
      await connection.execute(
        'INSERT INTO ratings (user_id, store_id, rating) VALUES (?, ?, ?)',
        [ids['user@storerating.local'], storeId, 5]
      );
      console.log('Created one sample rating.');
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  console.log(`Demo password for newly created demo accounts: ${demoPassword}`);
} catch (error) {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
