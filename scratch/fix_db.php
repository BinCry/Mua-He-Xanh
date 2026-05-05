<?php
/**
 * Script to add missing columns to the destinations table
 */
$config = require __DIR__ . '/../app/config.php';

try {
    $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};charset={$config['db_charset']}";
    $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    echo "Connecting to database: {$config['db_name']}...\n";

    // 1. Check if 'seasons' column exists
    $stmt = $pdo->prepare("SHOW COLUMNS FROM destinations LIKE 'seasons'");
    $stmt->execute();
    if (!$stmt->fetch()) {
        echo "Adding 'seasons' column to destinations table...\n";
        $pdo->exec("ALTER TABLE destinations ADD COLUMN seasons VARCHAR(255) DEFAULT NULL AFTER moods");
    } else {
        echo "'seasons' column already exists.\n";
    }

    // 2. Populate some sample data for seasons based on types if possible
    echo "Updating sample data for seasons...\n";
    
    // Winter-Spring: Chùa (temple), Làng nghề (craft)
    $pdo->exec("UPDATE destinations SET seasons = 'winter_spring' WHERE type IN ('temple', 'craft') AND seasons IS NULL");
    
    // Summer: Park, Nature
    $pdo->exec("UPDATE destinations SET seasons = 'summer' WHERE type IN ('park', 'nature') AND seasons IS NULL");

    // Láng Le (park) also good for Autumn-Winter
    $pdo->exec("UPDATE destinations SET seasons = 'summer,autumn_winter' WHERE name LIKE '%Láng Le%'");

    echo "Database updated successfully!\n";

} catch (PDOException $e) {
    die("Database Error: " . $e->getMessage() . "\n");
}
