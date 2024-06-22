const mysql = require("mysql2/promise");
const config = require("../../config.json");

const pool = mysql.createPool({
    host: config.database.host,
    database: config.database.database,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    queueLimit: 0,
    maxIdle: 16
});

const getConnection = async () => {
    if (config.database.type.toLowerCase() === "mysql") {
        try {
            const connection = await pool.getConnection();
            await createTables(connection);
            return connection;
        } catch (error) {
            throw new Error(`Error connecting to the database: ${error.message}`);
        }
    } else {
        throw new Error(`Unsupported database type: ${config.database.type}`);
    }
};

/** 
 * Create necessary database tables if they do not already exist.
 */
const createTables = async (connection) => {
    const query = `
        CREATE TABLE IF NOT EXISTS documents (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, 
            content TEXT NOT NULL
        );
    `;
    try {
        await connection.query(query);
    } catch (error) {
        console.error(`Failed to create tables: ${error.message}`);
        throw error;
    }
};

/** 
 * Execute a SQL query with given parameters.
 */
const executeQuery = async (sql, params = []) => {
    let connection;
    try {
        connection = await getConnection();
        const [results] = await connection.execute(sql, params);
        return results;
    } catch (error) {
        throw new Error(`Error executing query: ${error.message}`);
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

/** 
 * Retrieve a document by its ID.
 */
const getDocument = async (id) => {
    const sql = `SELECT * FROM documents WHERE id = ?`;
    try {
        const results = await executeQuery(sql, [id]);
        return results[0];
    } catch (error) {
        throw new Error(`Error retrieving document: ${error.message}`);
    }
};

/** 
 * Update a document's content by its ID.
 */
const updateDocument = async (id, content) => {
    const sql = `
        INSERT INTO documents (id, content)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE content = VALUES(content)
    `;
    try {
        const result = await executeQuery(sql, [id, content]);
        return result.affectedRows > 0;
    } catch (error) {
        console.error(`Error updating or inserting document: ${error.message}`);
        return false;
    }
};

/** 
 * Delete a document by its ID.
 */
const deleteDocument = async (id) => {
    const sql = `DELETE FROM documents WHERE id = ?`;

    try {
        const result = await executeQuery(sql, [id]);
        return result.affectedRows > 0;
    } catch (error) {
        console.error(`Error deleting document: ${error.message}`);
        return false;
    }
};

module.exports = {
    executeQuery,
    getConnection,
    getDocument,
    updateDocument,
    deleteDocument
};