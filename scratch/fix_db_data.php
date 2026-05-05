<?php
$config = require __DIR__ . '/../app/config.php';
try {
    $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};charset={$config['db_charset']}";
    $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    echo "Updating seasons data based on LOMAR marketing plan...\n";

    // Clear all first to be sure
    $pdo->exec("UPDATE destinations SET seasons = NULL");

    // 1. Chùa Thanh Tâm: All seasons (Winter-Spring: Lễ chùa, Summer: Khóa tu, Autumn: Vu Lan)
    $pdo->exec("UPDATE destinations SET seasons = 'winter_spring,summer,autumn_winter' WHERE name LIKE '%Thanh Tâm%'");

    // 2. Công viên Láng Le: All seasons (Spring: Hội xuân, Summer: Diều, Autumn: Trung Thu)
    $pdo->exec("UPDATE destinations SET seasons = 'winter_spring,summer,autumn_winter' WHERE name LIKE '%Láng Le%' AND type = 'park'");

    // 3. Vườn Mai: Primarily Winter-Spring (Tết)
    $pdo->exec("UPDATE destinations SET seasons = 'winter_spring' WHERE name LIKE '%Mai Vàng%'");

    // 4. Vườn Dừa: Primarily Summer
    $pdo->exec("UPDATE destinations SET seasons = 'summer' WHERE name LIKE '%Vườn Dừa%'");

    // 5. Làng nghề Nhang: All seasons (Spring: Làm nhang Tết, Summer: Gia đình, Autumn: Dâng hương)
    $pdo->exec("UPDATE destinations SET seasons = 'winter_spring,summer,autumn_winter' WHERE name LIKE '%Nhang%'");

    // 6. Di tích Láng Le - Bàu Cò (if exists)
    $pdo->exec("UPDATE destinations SET seasons = 'autumn_winter' WHERE name LIKE '%Bàu Cò%'");

    echo "Data updated successfully!\n";

} catch (PDOException $e) {
    die("Error: " . $e->getMessage());
}
