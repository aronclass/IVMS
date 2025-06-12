<?php
// api/sales.php
// API endpoint for handling sales data using PDO for SQLite.

include '../db_config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'User not authenticated.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$response = [];

try {
    switch ($method) {
        case 'GET':
            $sql = "SELECT s.*, p.name as productName 
                    FROM sales s 
                    JOIN products p ON s.productId = p.id 
                    ORDER BY s.date DESC, s.id DESC";
            $stmt = $pdo->query($sql);
            $sales = $stmt->fetchAll();
            $response = ['status' => 'success', 'data' => $sales];
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['productId']) || !isset($data['quantity']) || !isset($data['date'])) {
                http_response_code(400);
                $response = ['status' => 'error', 'message' => 'Missing required sale fields.'];
                break;
            }

            $pdo->beginTransaction();

            $productId = (int)$data['productId'];
            $quantity = (int)$data['quantity'];
            
            // 1. Get product price and current stock, and lock the row
            $stmt = $pdo->prepare("SELECT price, stock FROM products WHERE id = :id");
            $stmt->execute([':id' => $productId]);
            $product = $stmt->fetch();

            if (!$product) {
                throw new Exception("Product not found.");
            }
            
            // 2. Check stock
            $status = $data['status'] ?? 'completed';
            if ($status === 'completed' && $quantity > $product['stock']) {
                throw new Exception("Not enough stock available for this product.");
            }
            
            // 3. Insert sale record
            $stmt = $pdo->query("SELECT MAX(id) FROM sales");
            $maxId = $stmt->fetchColumn() ?? 0;
            $saleId = 'S' . str_pad($maxId + 1, 3, '0', STR_PAD_LEFT);
            
            $sql = "INSERT INTO sales (saleId, productId, customer, quantity, unitPrice, totalAmount, date, status) 
                    VALUES (:saleId, :productId, :customer, :quantity, :unitPrice, :totalAmount, :date, :status)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':saleId' => $saleId,
                ':productId' => $productId,
                ':customer' => $data['customer'] ?? 'N/A',
                ':quantity' => $quantity,
                ':unitPrice' => $product['price'],
                ':totalAmount' => $product['price'] * $quantity,
                ':date' => $data['date'],
                ':status' => $status
            ]);
            
            // 4. Update product stock
            if ($status === 'completed') {
                $newStock = $product['stock'] - $quantity;
                $updateStmt = $pdo->prepare("UPDATE products SET stock = :stock WHERE id = :id");
                $updateStmt->execute([':stock' => $newStock, ':id' => $productId]);
            }
            
            $pdo->commit();
            $response = ['status' => 'success', 'message' => 'Sale recorded successfully.'];
            break;

        default:
            http_response_code(405);
            $response = ['status' => 'error', 'message' => 'Method not supported.'];
            break;
    }
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    $response = ['status' => 'error', 'message' => 'Database transaction failed: ' . $e->getMessage()];
}

echo json_encode($response);
?>
