<?php
// db_config.php
// This file contains the database connection configuration for SQLite.

// Define the path to your SQLite database file.
// It will be created inside a 'db' folder at the same level as this file.
define('DB_FILE', __DIR__ . '/db/inventory.sqlite');

// Ensure the database directory exists.
if (!is_dir(dirname(DB_FILE))) {
    // 0775 permissions are generally safe for web servers
    mkdir(dirname(DB_FILE), 0775, true);
}

// --- PDO Database Connection ---
$pdo = null;

try {
    // Create a new PDO instance to connect to the SQLite database.
    $pdo = new PDO("sqlite:" . DB_FILE);

    // Set PDO error mode to exception for better error handling.
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Set default fetch mode to associative array for cleaner results.
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Enable foreign key support in SQLite.
    $pdo->exec('PRAGMA foreign_keys = ON;');

    // --- Database Schema Initialization ---
    // Create tables if they don't exist.
    // This will prevent "no such table" errors on first run or if db is reset.

    // Create 'users' table if it doesn't exist
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL, -- Password column added/ensured for authentication
        fullName TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );");

    // Create 'products' table if it doesn't exist
    $pdo->exec("CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        price REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        minStock INTEGER NOT NULL DEFAULT 0,
        maxStock INTEGER, -- Added maxStock column (nullable)
        description TEXT, -- Added description column
        lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP, -- Added lastUpdated column
        status TEXT NOT NULL DEFAULT 'active', -- Added status column for soft delete
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );");

    // Add missing columns if they don't exist (for existing databases)
    $columns = $pdo->query("PRAGMA table_info(products);")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('maxStock', $columns)) {
        $pdo->exec("ALTER TABLE products ADD COLUMN maxStock INTEGER;");
    }
    if (!in_array('description', $columns)) {
        $pdo->exec("ALTER TABLE products ADD COLUMN description TEXT;");
    }
    if (!in_array('lastUpdated', $columns)) {
        $pdo->exec("ALTER TABLE products ADD COLUMN lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP;");
    }
    if (!in_array('status', $columns)) {
        $pdo->exec("ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'active';");
    }

    // Create 'sales' table if it doesn't exist
    $pdo->exec("CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        saleId TEXT NOT NULL,
        productId INTEGER NOT NULL,
        customer TEXT,
        quantity INTEGER NOT NULL,
        unitPrice REAL NOT NULL,
        totalAmount REAL NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL, -- e.g., 'completed', 'pending'
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    );");

    // Create default admin user if no users exist
    $stmt = $pdo->query("SELECT COUNT(*) FROM users");
    $count = $stmt->fetchColumn();
    if ($count == 0) {
        $username = 'admin';
        $password = password_hash('1234', PASSWORD_DEFAULT);
        $fullName = 'Administrator';
        $email = 'admin@inventory.com';
        
        $stmt = $pdo->prepare("INSERT INTO users (username, password, fullName, email) VALUES (?, ?, ?, ?)");
        $stmt->execute([$username, $password, $fullName, $email]);
    }

} catch(PDOException $e){
    // If connection fails, stop everything and show an error.
    http_response_code(500);
    die("ERROR: Could not connect to the database. " . $e->getMessage());
}

// Start the session for login state management.
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}
?>
