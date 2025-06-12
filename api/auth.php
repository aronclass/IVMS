<?php
// api/auth.php
// Handles user login and session management using PDO for SQLite.

include '../db_config.php'; // This now includes the PDO connection object '$pdo'

header('Content-Type: application/json');

$response = ['status' => 'error', 'message' => 'Invalid request.'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    if (isset($data['action'])) {
        if ($data['action'] === 'login') {
            if (!empty($data['username']) && !empty($data['password'])) {
                $username = $data['username'];
                $password = $data['password'];

                // 1. Prepare and execute the query to find the user by username
                $stmt = $pdo->prepare("SELECT * FROM users WHERE username = :username");
                $stmt->execute([':username' => $username]);
                $user = $stmt->fetch();

                // 2. Check if user exists and verify password
                if ($user && password_verify($password, $user['password'])) {
                    // Login successful: Set session variables
                    $_SESSION['loggedin'] = true;
                    $_SESSION['username'] = $user['username'];
                    // Store other user details you might need on the client-side
                    $_SESSION['user_id'] = $user['id'];
                    $_SESSION['fullName'] = $user['fullName'] ?? 'N/A';
                    $_SESSION['email'] = $user['email'] ?? 'N/A';

                    $response = [
                        'status' => 'success',
                        'message' => 'Login successful.',
                        'user' => [
                            'username' => $_SESSION['username'],
                            'fullName' => $_SESSION['fullName'],
                            'email' => $_SESSION['email']
                        ]
                    ];
                } else {
                    // Authentication failed
                    http_response_code(401); // Unauthorized
                    $response['message'] = 'Invalid username or password.';
                }
            } else {
                http_response_code(400); // Bad Request
                $response['message'] = 'Username and password are required.';
            }
        } elseif ($data['action'] === 'logout') {
            // Clear all session variables and destroy the session
            $_SESSION = array();
            session_destroy();
            $response = ['status' => 'success', 'message' => 'Logout successful.'];
        }
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['action']) && $_GET['action'] === 'check_session') {
        if (isset($_SESSION['loggedin']) && $_SESSION['loggedin'] === true) {
            $response = [
                'status' => 'success',
                'loggedin' => true,
                'user' => [
                    'username' => $_SESSION['username'],
                    'fullName' => $_SESSION['fullName'] ?? 'N/A', // Provide default if not set
                    'email' => $_SESSION['email'] ?? 'N/A' // Provide default if not set
                ]
            ];
        } else {
            $response = ['status' => 'success', 'loggedin' => false];
        }
    }
}

echo json_encode($response);
