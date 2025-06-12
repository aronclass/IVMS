<?php
// api/products.php
// API endpoint for product CRUD operations using PDO for SQLite.

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
            // Fetch products, default to active ones, but allow fetching archived if requested
            $includeArchived = isset($_GET['includeArchived']) && $_GET['includeArchived'] === 'true';
            $sql = "SELECT * FROM products";
            if (!$includeArchived) {
                $sql .= " WHERE status = 'active'";
            }
            $sql .= " ORDER BY name ASC";
            
            $stmt = $pdo->query($sql);
            $products = $stmt->fetchAll();
            $response = ['status' => 'success', 'data' => $products];
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);
            
            // Validate required fields for add/update
            // If the only change is status, these might be missing.
            // Re-fetch product data if only status is being updated, then merge.
            if (isset($data['id']) && isset($data['status']) && 
                (!isset($data['name']) || !isset($data['price']) || !isset($data['stock']) || !isset($data['minStock']))) {
                
                $stmt = $pdo->prepare("SELECT * FROM products WHERE id = :id");
                $stmt->execute([':id' => $data['id']]);
                $existingProduct = $stmt->fetch();
                if ($existingProduct) {
                    $data = array_merge($existingProduct, $data); // Merge existing data with new status
                } else {
                    http_response_code(404);
                    $response = ['status' => 'error', 'message' => 'Product not found for status update.'];
                    break;
                }
            } elseif (empty($data['name']) || !isset($data['price']) || !isset($data['stock']) || !isset($data['minStock'])) {
                 http_response_code(400);
                 $response = ['status' => 'error', 'message' => 'Missing required product fields for add/update.'];
                 break;
            }

            $id = $data['id'] ?? null;

            if ($id) {
                // Update existing product
                $sql = "UPDATE products SET name = :name, category = :category, price = :price, stock = :stock, minStock = :minStock, maxStock = :maxStock, description = :description, lastUpdated = :lastUpdated, status = :status WHERE id = :id";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':name' => $data['name'],
                    ':category' => $data['category'] ?? 'Uncategorized',
                    ':price' => $data['price'],
                    ':stock' => $data['stock'],
                    ':minStock' => $data['minStock'],
                    ':maxStock' => $data['maxStock'] ?? null, // Use null if not provided
                    ':description' => $data['description'] ?? '',
                    ':lastUpdated' => date('c'), // ISO 8601 format
                    ':status' => $data['status'] ?? 'active', // Default to active if not provided
                    ':id' => $id
                ]);
                $response = ['status' => 'success', 'message' => 'Product updated successfully.'];
            } else {
                // Insert new product
                $sql = "INSERT INTO products (name, category, price, stock, minStock, maxStock, description, lastUpdated, status) VALUES (:name, :category, :price, :stock, :minStock, :maxStock, :description, :lastUpdated, :status)";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':name' => $data['name'],
                    ':category' => $data['category'] ?? 'Uncategorized',
                    ':price' => $data['price'],
                    ':stock' => $data['stock'],
                    ':minStock' => $data['minStock'],
                    ':maxStock' => $data['maxStock'] ?? null, // Use null if not provided
                    ':description' => $data['description'] ?? '',
                    ':lastUpdated' => date('c'), // ISO 8601 format
                    ':status' => $data['status'] ?? 'active' // Default to active for new products
                ]);
                $newId = $pdo->lastInsertId();
                $response = ['status' => 'success', 'message' => 'Product added successfully.', 'id' => $newId];
            }
            break;

        case 'DELETE':
            if (!isset($_GET['id'])) {
                http_response_code(400);
                $response = ['status' => 'error', 'message' => 'Product ID is required.'];
                break;
            }
            $id = (int)$_GET['id'];
            
            // --- IMPORTANT CHANGE: The sales record check has been removed. ---
            // --- This will now allow direct deletion of products, even if   ---
            // --- they have associated sales records. This can lead to      ---
            // --- data inconsistencies in your sales history.               ---
            
            $stmt = $pdo->prepare("DELETE FROM products WHERE id = :id");
            $stmt->execute([':id' => $id]);
            $response = ['status' => 'success', 'message' => 'Product permanently deleted.'];
            break;

        default:
            http_response_code(405); // Method Not Allowed
            $response = ['status' => 'error', 'message' => 'Method not supported.'];
            break;
    }
} catch (PDOException $e) {
    http_response_code(500); // Internal Server Error
    $response = ['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()];
} catch (Exception $e) {
    http_response_code(500); // Internal Server Error for other exceptions
    $response = ['status' => 'error', 'message' => 'Server error: ' . $e->getMessage()];
}

echo json_encode($response);
?>
