require("dotenv").config()

const { Pool, types } = require("pg");

types.setTypeParser(1082, (value) => value);

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});


// async function testConnection(){
//     try{
//         const result = await pool.query("Select NOW()");
//         console.log("database connected successfully");
//         console.log("PostgreSQL time:", result.rows[0].now);        
//     } catch (error){
//         console.error("Database connection failed", error.message);
//     }

// }

// testConnection()

module.exports = pool