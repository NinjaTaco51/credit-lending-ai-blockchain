// db.js
import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL not found');

const sql = postgres(connectionString, { ssl: 'require' });
export default sql;
