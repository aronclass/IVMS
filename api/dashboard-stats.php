<?php
// api/dashboard-stats.php
// Endpoint to fetch aggregated data for the dashboard cards using PDO for SQLite.

include '../db_config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'User not authenticated.']);
    exit;
}

$response = [];

try {
    // Total Products
    $stmt = $pdo->query("SELECT COUNT(*) FROM products");
    $total_products = $stmt->fetchColumn();

    // Total Sales Transactions
    $stmt = $pdo->query("SELECT COUNT(*) FROM sales");
    $total_sales = $stmt->fetchColumn();
    
    // Low Stock Items
    $stmt = $pdo->query("SELECT COUNT(*) FROM products WHERE stock < minStock AND stock > 0");
    $low_stock_items = $stmt->fetchColumn();

    // Revenue This Month
    $current_month = date('Y-m-01');
    $stmt = $pdo->prepare("SELECT SUM(totalAmount) FROM sales WHERE status = 'completed' AND date >= :current_month");
    $stmt->execute([':current_month' => $current_month]);
    $revenue_month = $stmt->fetchColumn() ?? 0;

    $response = [
        'status' => 'success',
        'data' => [
            'totalProducts' => (int)$total_products,
            'totalSales' => (int)$total_sales,
            'lowStockItems' => (int)$low_stock_items,
            'revenueThisMonth' => (float)$revenue_month
        ]
    ];

} catch (PDOException $e) {
    http_response_code(500);
    $response = ['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()];
}

echo json_encode($response);

?>
