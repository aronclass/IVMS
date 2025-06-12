// --- APPLICATION STATE & DATA ---
// This data will now be fetched from the backend.
// These arrays will act as a local cache.
let currentUser = null;
let products = [];
let sales = [];

let monthlySalesChartInstance = null; 

// --- DOM ELEMENTS ---
const loginPage = document.getElementById('loginPage');
const mainApp = document.getElementById('mainApp');
const pageTitle = document.getElementById('pageTitle');
const sidebar = document.getElementById('sidebar'); 
const sidebarToggleButton = document.getElementById('sidebarToggleButton');
const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');
const productModalTitle = document.getElementById('productModalTitle');
const saleModal = document.getElementById('saleModal');
const saleForm = document.getElementById('saleForm');
const saleModalTitle = document.getElementById('saleModalTitle');
const viewProductModal = document.getElementById('viewProductModal');
const viewSaleModal = document.getElementById('viewSaleModal');
const updateStockModal = document.getElementById('updateStockModal');
const updateStockForm = document.getElementById('updateStockForm');


// --- INITIALIZATION & ROUTING ---
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('loginForm').addEventListener('submit', login);
    document.getElementById('profileUpdateForm').addEventListener('submit', updateProfile);
    document.getElementById('passwordChangeForm').addEventListener('submit', changePassword);
    productForm.addEventListener('submit', handleProductFormSubmit);
    saleForm.addEventListener('submit', handleSaleFormSubmit);
    updateStockForm.addEventListener('submit', handleUpdateStockFormSubmit);
    
    sidebarToggleButton.addEventListener('click', () => {
        document.body.classList.toggle('sidebar-is-collapsed');
    });

    const saleProductSelect = document.getElementById('saleProduct');
    const saleQuantityInput = document.getElementById('saleQuantity');
    saleProductSelect.addEventListener('change', updateSalePriceAndMaxQuantity);
    saleQuantityInput.addEventListener('input', updateSaleTotalAmount);

    document.getElementById('updateStockProductSelect').addEventListener('change', populateCurrentStockForUpdate);

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('saleDate').value = today;
    
    checkSession(); // Check for active session first
    window.addEventListener('hashchange', handleRouteChange);

    console.log('Inventory Management System Initialized for Backend Interaction.');
});

async function checkSession() {
    try {
        const response = await fetch('api/auth.php?action=check_session');
        const result = await response.json();
        if (result.status === 'success' && result.loggedin) {
            currentUser = result.user;
            await loadInitialData(); // Load data before routing
            handleRouteChange();
        } else {
            handleRouteChange(); // Will show login page
        }
    } catch (error) {
        console.error("Session check failed:", error);
        handleRouteChange();
    }
}

async function loadInitialData() {
    // This function fetches all necessary data after login
    try {
        const [productsResponse, salesResponse] = await Promise.all([
            fetch('api/products.php'),
            fetch('api/sales.php')
        ]);

        const productsResult = await productsResponse.json();
        if(productsResult.status === 'success') {
            products = productsResult.data;
        } else {
            showNotification('Failed to load products: ' + productsResult.message, 'error');
        }

        const salesResult = await salesResponse.json();
        if(salesResult.status === 'success') {
            sales = salesResult.data;
        } else {
            showNotification('Failed to load sales: ' + salesResult.message, 'error');
        }
        
    } catch (error) {
        showNotification('An error occurred while loading data.', 'error');
        console.error("Data loading error:", error);
    }
}


function handleRouteChange() {
    if (!currentUser) {
        mainApp.classList.remove('active');
        loginPage.classList.add('active');
        document.body.classList.add('sidebar-is-collapsed'); 
        return; 
    }

    mainApp.classList.add('active');
    loginPage.classList.remove('active');
    
    const hash = window.location.hash.substring(1); 
    const defaultPage = 'dashboard';
    const pageToLoad = hash || defaultPage;
    
    const validPages = ['dashboard', 'products', 'sales', 'inventory', 'reports', 'profile'];
    if (validPages.includes(pageToLoad)) {
        showPageContent(pageToLoad);
    } else {
        window.location.hash = defaultPage; 
    }
}


// --- AUTHENTICATION ---
async function login(event) {
    event.preventDefault();
    const usernameInput = document.getElementById('username').value;
    const passwordInput = document.getElementById('password').value;
    
    if (usernameInput.trim() === "" || passwordInput.trim() === "") {
        showNotification('Please enter both username and password.', 'error');
        return;
    }

    try {
        const response = await fetch('api/auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', username: usernameInput, password: passwordInput })
        });
        const result = await response.json();

        if (result.status === 'success') {
            currentUser = result.user;
            await loadInitialData(); // Fetch fresh data on login
            document.body.classList.remove('sidebar-is-collapsed'); 
            window.location.hash = '#dashboard'; 
            loadProfileData(); 
            showNotification('Login successful! Welcome.', 'success');
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error){
        showNotification('An error occurred during login.', 'error');
        console.error("Login error:", error);
    }
}

async function logout() {
    await fetch('api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
    });

    currentUser = null;
    products = [];
    sales = [];
    window.location.hash = ''; 
    showNotification('You have been logged out successfully.', 'info');
    if (monthlySalesChartInstance) {
        monthlySalesChartInstance.destroy(); 
        monthlySalesChartInstance = null;
    }
     document.body.classList.add('sidebar-is-collapsed'); 
}

// --- NAVIGATION & PAGE DISPLAY ---
function showPageContent(pageName) {
    document.querySelectorAll('.content-page').forEach(p => p.classList.remove('active'));
    const targetPageElement = document.getElementById(pageName + 'Content');
    if (targetPageElement) {
        targetPageElement.classList.add('active');
    } else {
        document.getElementById('dashboardContent').classList.add('active'); 
        pageName = 'dashboard'; 
        if(window.location.hash !== "#dashboard") window.location.hash = "dashboard";
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === '#' + pageName) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
    const titles = {
        'dashboard': 'Dashboard', 'products': 'Products Management', 'sales': 'Sales Management',
        'inventory': 'Inventory Overview', 'reports': 'Reports & Analytics', 'profile': 'User Profile'
    };
    pageTitle.textContent = titles[pageName] || 'Dashboard';
    
    if (pageName === 'dashboard') {
        updateDashboardCards();
        updateRecentActivity();
    }
    if (pageName === 'products') renderProductsTable();
    if (pageName === 'sales') renderSalesTable();
    if (pageName === 'inventory') renderInventoryPage();
    if (pageName === 'reports') renderReportsPage(); 
    if (pageName === 'profile' && currentUser) loadProfileData();

    if (pageName === 'products') populateCategoryFilter();
}

// --- DASHBOARD ---
async function updateDashboardCards() {
    try {
        const response = await fetch('api/dashboard-stats.php');
        const result = await response.json();
        if(result.status === 'success') {
            const data = result.data;
            document.getElementById('totalProductsCard').textContent = data.totalProducts;
            document.getElementById('totalSalesCard').textContent = data.totalSales;
            document.getElementById('lowStockItemsCard').textContent = data.lowStockItems;
            document.getElementById('revenueMonthCard').textContent = `₹${parseFloat(data.revenueThisMonth).toFixed(2)}`;
        } else {
             showNotification('Failed to load dashboard stats.', 'error');
        }
    } catch(error) {
        console.error("Failed to fetch dashboard stats:", error);
    }
}

function updateRecentActivity() {
    const tbody = document.getElementById('recentActivityTableBody');
    tbody.innerHTML = '';

    // Sort sales by date descending and get the last 5
    const recentSales = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    if (recentSales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No recent activity.</td></tr>';
        return;
    }

    recentSales.forEach(sale => {
        const row = tbody.insertRow();
        const statusInfo = { text: sale.status, class: sale.status };
        row.innerHTML = `
            <td>${sale.productName}</td>
            <td>Sale</td>
            <td>${sale.quantity}</td>
            <td>${new Date(sale.date).toLocaleDateString()}</td>
            <td><span class="status ${statusInfo.class}">${statusInfo.text}</span></td>
        `;
    });
}

// --- PRODUCT MANAGEMENT ---
function openProductModal(productId = null) {
    productForm.reset();
    document.getElementById('productId').value = '';
    if (productId) {
        const product = products.find(p => p.id == productId);
        if (product) {
            productModalTitle.textContent = 'Edit Product';
            document.getElementById('productId').value = product.id;
            document.getElementById('productName').value = product.name;
            document.getElementById('productCategory').value = product.category;
            document.getElementById('productPrice').value = product.price;
            document.getElementById('productStock').value = product.stock;
            document.getElementById('productMinStock').value = product.minStock;
            // Ensure maxStock is set, or empty string if null
            document.getElementById('productMaxStock').value = product.maxStock !== null ? product.maxStock : '';
            document.getElementById('productDescription').value = product.description || '';
        }
    } else {
        productModalTitle.textContent = 'Add New Product';
    }
    productModal.classList.add('show');
}

function closeProductModal() {
    productModal.classList.remove('show');
}

async function handleProductFormSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('productId').value;
    const maxStockValue = document.getElementById('productMaxStock').value;
    const productData = {
        name: document.getElementById('productName').value,
        category: document.getElementById('productCategory').value,
        price: parseFloat(document.getElementById('productPrice').value),
        stock: parseInt(document.getElementById('productStock').value),
        minStock: parseInt(document.getElementById('productMinStock').value),
        // Pass null if maxStock is empty, otherwise parse as int
        maxStock: maxStockValue === '' ? null : parseInt(maxStockValue),
        description: document.getElementById('productDescription').value
    };

    if (id) {
        productData.id = parseInt(id);
    }
    
    try {
        const response = await fetch('api/products.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(productData)
        });
        const result = await response.json();

        if (result.status === 'success') {
            showNotification(result.message, 'success');
            await loadInitialData(); // Refresh all data from server
            if (window.location.hash === '#products') renderProductsTable();
            if (window.location.hash === '#inventory') renderInventoryPage(); 
            updateDashboardCards();
            populateProductDropdowns(); 
            populateCategoryFilter();
            closeProductModal();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        showNotification('An error occurred while saving the product.', 'error');
        console.error("Product save error:", error);
    }
}

function viewProduct(productId) {
    const product = products.find(p => p.id == productId);
    if (product) {
        const detailsHtml = `
            <p><strong>ID:</strong> ${String(product.id).padStart(3, '0')}</p>
            <p><strong>Name:</strong> ${product.name}</p>
            <p><strong>Category:</strong> ${product.category}</p>
            <p><strong>Price:</strong> ₹${parseFloat(product.price).toFixed(2)}</p>
            <p><strong>Current Stock:</strong> ${product.stock}</p>
            <p><strong>Min Stock:</strong> ${product.minStock}</p>
            <p><strong>Max Stock:</strong> ${product.maxStock !== null ? product.maxStock : 'N/A'}</p>
            <p><strong>Description:</strong> ${product.description || 'N/A'}</p>
            <p><strong>Last Updated:</strong> ${new Date(product.lastUpdated).toLocaleString()}</p>
        `;
        document.getElementById('viewProductDetails').innerHTML = detailsHtml;
        viewProductModal.classList.add('show');
    }
}
function closeViewProductModal() {
    viewProductModal.classList.remove('show');
}

async function deleteProduct(productId) {
    // Replace confirm with a custom modal/dialog
    let resolver;
    const userConfirmed = await new Promise(resolve => {
        resolver = resolve;
        const confirmationModal = document.createElement('div');
        confirmationModal.className = 'modal show';
        confirmationModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Confirm Deletion</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove(); document.body.style.overflow = 'auto';">${"&times;"}</button>
                </div>
                <p>Are you sure you want to delete this product?</p>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="cancelDeleteBtn">Cancel</button>
                    <button type="button" class="btn" id="confirmDeleteBtn">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmationModal);
        document.body.style.overflow = 'hidden'; // Prevent scrolling background

        // Attach event listeners to resolve the promise
        confirmationModal.querySelector('#cancelDeleteBtn').onclick = function() {
            confirmationModal.remove();
            document.body.style.overflow = 'auto';
            resolve(false);
        };
        confirmationModal.querySelector('#confirmDeleteBtn').onclick = function() {
            confirmationModal.remove();
            document.body.style.overflow = 'auto';
            resolve(true);
        };
        // Also close on X button (does not confirm)
        confirmationModal.querySelector('.close-btn').onclick = function() {
            confirmationModal.remove();
            document.body.style.overflow = 'auto';
            resolve(false);
        };
    });

    if (userConfirmed) {
        try {
            const response = await fetch(`api/products.php?id=${productId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (response.ok && result.status === 'success') {
                showNotification(result.message, 'success');
                await loadInitialData(); // Refresh data
                if (window.location.hash === '#products') renderProductsTable();
                if (window.location.hash === '#inventory') renderInventoryPage();
                updateDashboardCards();
                populateProductDropdowns();
                populateCategoryFilter();
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
             showNotification('An error occurred during deletion.', 'error');
             console.error("Delete product error:", error);
        }
    }
}
        
function getProductStatus(product) {
    if (product.stock <= 0) return { text: 'Out of Stock', class: 'out' };
    if (product.stock < product.minStock) return { text: 'Low Stock', class: 'low' };
    // Check if maxStock is a valid number before comparing
    if (product.maxStock !== null && product.stock > product.maxStock) return { text: 'Overstocked', class: 'overstocked'};
    return { text: 'Active', class: 'active' };
}

function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = '';
    const searchTerm = document.getElementById('productSearchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('productCategoryFilter').value;
    const statusFilter = document.getElementById('productStatusFilter').value;

    const filteredProducts = products.filter(p => {
        const statusInfo = getProductStatus(p);
        const matchesSearch = p.name.toLowerCase().includes(searchTerm) || String(p.id).includes(searchTerm);
        const matchesCategory = categoryFilter ? p.category === categoryFilter : true;
        const matchesStatus = statusFilter ? statusInfo.class === statusFilter : true;
        return matchesSearch && matchesCategory && matchesStatus;
    });

    if (filteredProducts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No products found.</td></tr>`;
        return;
    }

    filteredProducts.forEach(product => {
        const row = tbody.insertRow();
        const statusInfo = getProductStatus(product);
        row.innerHTML = `
            <td>${String(product.id).padStart(3, '0')}</td>
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td>₹${parseFloat(product.price).toFixed(2)}</td>
            <td>${product.stock}</td>
            <td>${product.minStock}</td>
            <td><span class="status ${statusInfo.class}">${statusInfo.text}</span></td>
            <td>
                <div class="action-btn-group">
                    <button class="action-btn view" onclick="viewProduct(${product.id})">View</button>
                    <button class="action-btn edit" onclick="openProductModal(${product.id})">Edit</button>
                    <button class="action-btn delete" onclick="deleteProduct(${product.id})">Delete</button>
                </div>
            </td>
        `;
    });
}
        
function populateCategoryFilter() {
    const categories = [...new Set(products.map(p => p.category))].sort();
    const filterSelect = document.getElementById('productCategoryFilter');
    const currentCategoryValue = filterSelect.value; 
    filterSelect.innerHTML = '<option value="">All Categories</option>'; 
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        filterSelect.appendChild(option);
    });
    filterSelect.value = currentCategoryValue; 
}


// --- SALES MANAGEMENT ---
function populateProductDropdowns() {
    const saleProductSelect = document.getElementById('saleProduct');
    const updateStockProductSelect = document.getElementById('updateStockProductSelect');
    
    const currentSaleProduct = saleProductSelect.value;
    const currentStockProduct = updateStockProductSelect.value;

    saleProductSelect.innerHTML = '<option value="">-- Select Product --</option>';
    updateStockProductSelect.innerHTML = '<option value="">-- Select Product --</option>';

    products.sort((a,b) => a.name.localeCompare(b.name)).forEach(product => { 
        if (product.stock > 0) {
            const saleOption = document.createElement('option');
            saleOption.value = product.id;
            saleOption.textContent = `${product.name} (Stock: ${product.stock})`;
            saleProductSelect.appendChild(saleOption);
        }

        const stockOption = document.createElement('option');
        stockOption.value = product.id;
        stockOption.textContent = product.name;
        updateStockProductSelect.appendChild(stockOption);
    });
    if(products.some(p => p.id == currentSaleProduct && p.stock > 0)) saleProductSelect.value = currentSaleProduct;
    if(products.some(p => p.id == currentStockProduct)) updateStockProductSelect.value = currentStockProduct;
}

function updateSalePriceAndMaxQuantity() {
    const productId = document.getElementById('saleProduct').value;
    const unitPriceInput = document.getElementById('saleUnitPrice');
    const quantityInput = document.getElementById('saleQuantity');
    
    if (productId) {
        const product = products.find(p => p.id == productId);
        if (product) {
            unitPriceInput.value = parseFloat(product.price).toFixed(2);
            quantityInput.max = product.stock; 
            quantityInput.value = 1; 
            if (product.stock === 0) {
                 showNotification(`${product.name} is out of stock.`, 'warning');
                 quantityInput.value = 0;
                 quantityInput.disabled = true;
            } else {
                quantityInput.disabled = false;
            }
        }
    } else {
        unitPriceInput.value = '';
        quantityInput.max = '';
        quantityInput.value = '';
    }
    updateSaleTotalAmount();
}

function updateSaleTotalAmount() {
    const quantity = parseFloat(document.getElementById('saleQuantity').value) || 0;
    const unitPrice = parseFloat(document.getElementById('saleUnitPrice').value) || 0;
    const totalAmount = quantity * unitPrice;
    document.getElementById('saleTotalAmount').textContent = totalAmount.toFixed(2);
}


function openSaleModal(saleId = null) { 
    saleForm.reset();
    document.getElementById('saleId').value = '';
    populateProductDropdowns(); 
    document.getElementById('saleDate').value = new Date().toISOString().split('T')[0]; 
    updateSalePriceAndMaxQuantity(); 
    saleModalTitle.textContent = 'Record New Sale';
    saleModal.classList.add('show');
}

function closeSaleModal() {
    saleModal.classList.remove('show');
}

async function handleSaleFormSubmit(event) {
    event.preventDefault();
    const saleData = {
        productId: parseInt(document.getElementById('saleProduct').value),
        quantity: parseInt(document.getElementById('saleQuantity').value),
        customer: document.getElementById('saleCustomer').value,
        date: document.getElementById('saleDate').value,
        status: document.getElementById('saleStatus').value
    };
    
    if (isNaN(saleData.productId)) {
        showNotification('Please select a product.', 'error');
        return;
    }

    try {
        const response = await fetch('api/sales.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(saleData)
        });
        const result = await response.json();
        if (result.status === 'success') {
            showNotification(result.message, 'success');
            await loadInitialData();
            if (window.location.hash === '#sales') renderSalesTable();
            if (window.location.hash === '#products') renderProductsTable(); 
            if (window.location.hash === '#inventory') renderInventoryPage(); 
            if (window.location.hash === '#reports') renderReportsPage();
            updateDashboardCards();
            closeSaleModal();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        showNotification('An error occurred while recording the sale.', 'error');
        console.error('Sale error:', error);
    }
}

function viewSale(saleId) {
    const sale = sales.find(s => s.saleId === saleId);
    if (sale) {
        const product = products.find(p => p.id == sale.productId); 
        const detailsHtml = `
            <p><strong>Sale ID:</strong> ${sale.saleId}</p>
            <p><strong>Date:</strong> ${new Date(sale.date).toLocaleDateString()}</p>
            <p><strong>Product:</strong> ${sale.productName} (ID: ${sale.productId})</p>
            <p><strong>Customer:</strong> ${sale.customer || 'N/A'}</p>
            <p><strong>Quantity:</strong> ${sale.quantity}</p>
            <p><strong>Unit Price:</strong> ₹${parseFloat(sale.unitPrice).toFixed(2)}</p>
            <p><strong>Total Amount:</strong> ₹${parseFloat(sale.totalAmount).toFixed(2)}</p>
            <p><strong>Status:</strong> <span class="status ${sale.status}">${sale.status}</span></p>
            ${product ? `<p><em>Current Product Stock: ${product.stock}</em></p>` : '<p><em>Product details not found.</em></p>'}
        `;
        document.getElementById('viewSaleDetails').innerHTML = detailsHtml;
        viewSaleModal.classList.add('show');
    }
}
function closeViewSaleModal() {
    viewSaleModal.classList.remove('show');
}


function renderSalesTable() {
    const tbody = document.getElementById('salesTableBody');
    tbody.innerHTML = '';
    const searchTerm = document.getElementById('salesSearchInput').value.toLowerCase();
    const dateFilter = document.getElementById('salesDateFilter').value;
    const statusFilter = document.getElementById('salesStatusFilter').value;

    const filteredSales = sales.filter(s => {
        const matchesSearch = s.saleId.toLowerCase().includes(searchTerm) || 
                              s.productName.toLowerCase().includes(searchTerm) || 
                              (s.customer && s.customer.toLowerCase().includes(searchTerm));
        const matchesDate = dateFilter ? s.date === dateFilter : true;
        const matchesStatus = statusFilter ? s.status === statusFilter : true;
        return matchesSearch && matchesDate && matchesStatus;
    });

    if (filteredSales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No sales records found.</td></tr>`;
        return;
    }

    filteredSales.forEach(sale => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${sale.saleId}</td>
            <td>${new Date(sale.date).toLocaleDateString()}</td>
            <td>${sale.productName}</td>
            <td>${sale.customer || 'N/A'}</td>
            <td>${sale.quantity}</td>
            <td>₹${parseFloat(sale.unitPrice).toFixed(2)}</td>
            <td>₹${parseFloat(sale.totalAmount).toFixed(2)}</td>
            <td><span class="status ${sale.status}">${sale.status}</span></td>
            <td>
                <div class="action-btn-group">
                    <button class="action-btn view" onclick="viewSale('${sale.saleId}')">View</button>
                </div>
            </td>
        `;
    });
}

// --- INVENTORY MANAGEMENT ---
function renderInventoryPage() {
    renderInventorySummaryCards();
    renderInventoryTable();
}

async function renderInventorySummaryCards() {
    // Re-using dashboard stats for this as they are similar
    try {
        const response = await fetch('api/dashboard-stats.php');
        const result = await response.json();
        if(result.status === 'success') {
            const data = result.data;
            const totalInventoryValue = products.reduce((sum, p) => sum + (p.stock * p.price), 0);
            const distinctCategories = new Set(products.map(p => p.category)).size;

            const container = document.getElementById('inventorySummaryCards');
            container.innerHTML = `
                <div class="stat-card"><h3>${data.lowStockItems}</h3><p>Low Stock Alert</p></div>
                <div class="stat-card"><h3>${products.filter(p=>p.stock <=0).length}</h3><p>Out of Stock</p></div>
                <div class="stat-card"><h3>₹${totalInventoryValue.toFixed(2)}</h3><p>Total Inventory Value</p></div>
                <div class="stat-card"><h3>${distinctCategories}</h3><p>Product Categories</p></div>
            `;
        }
    } catch(error) {
        console.error("Failed to fetch inventory stats:", error);
    }
}

function openUpdateStockModal(productId = null) {
    updateStockForm.reset();
    populateProductDropdowns(); 
    document.getElementById('currentStockDisplay').value = ''; 

    if (productId) {
        document.getElementById('updateStockProductSelect').value = productId;
        populateCurrentStockForUpdate(); 
    }
    updateStockModal.classList.add('show');
}

function closeUpdateStockModal() {
    updateStockModal.classList.remove('show');
}

function populateCurrentStockForUpdate() {
    const productId = document.getElementById('updateStockProductSelect').value;
    const currentStockDisplay = document.getElementById('currentStockDisplay');
    if (productId) {
        const product = products.find(p => p.id == productId);
        if (product) {
            currentStockDisplay.value = product.stock;
            document.getElementById('newStockLevel').value = product.stock; 
        } else {
            currentStockDisplay.value = 'N/A';
        }
    } else {
        currentStockDisplay.value = '';
    }
}

async function handleUpdateStockFormSubmit(event) {
    event.preventDefault();
    const productId = parseInt(document.getElementById('updateStockProductSelect').value);
    const newStockLevel = parseInt(document.getElementById('newStockLevel').value);
    
    const product = products.find(p => p.id === productId);
    if (!product) {
        showNotification('Product not found.', 'error');
        return;
    }

    const productData = { ...product, stock: newStockLevel };

    try {
        const response = await fetch('api/products.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(productData)
        });
        const result = await response.json();
        if (result.status === 'success') {
            showNotification('Stock updated successfully', 'success');
            await loadInitialData();
            if (window.location.hash === '#inventory') renderInventoryTable();
            if (window.location.hash === '#products') renderProductsTable(); 
            if (window.location.hash === '#reports') renderReportsPage(); 
            updateDashboardCards(); 
            closeUpdateStockModal();
        } else {
            showNotification(result.message, 'error');
        }
    } catch(error) {
        console.error("Update stock error:", error);
    }
}


function renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '';
    const searchTerm = document.getElementById('inventorySearchInput').value.toLowerCase();
    const statusFilter = document.getElementById('inventoryStatusFilter').value;

    const filteredInventory = products.filter(p => {
        const statusInfo = getProductStatus(p); 
        const matchesSearch = p.name.toLowerCase().includes(searchTerm);
        let effectiveStatusClass = statusInfo.class;
        if (statusInfo.class === 'active') effectiveStatusClass = 'normal'; 
        
        const matchesStatus = statusFilter ? effectiveStatusClass === statusFilter : true;
        return matchesSearch && matchesStatus;
    });

    if (filteredInventory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No inventory items found.</td></tr>`;
        return;
    }

    filteredInventory.forEach(product => {
        const row = tbody.insertRow();
        const statusInfo = getProductStatus(product);
        row.innerHTML = `
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td>${product.stock}</td>
            <td>${product.minStock}</td>
            <td>${product.maxStock !== null ? product.maxStock : 'N/A'}</td>
            <td><span class="status ${statusInfo.class}">${statusInfo.text}</span></td>
            <td>${new Date(product.lastUpdated).toLocaleDateString()}</td>
            <td>
                <div class="action-btn-group">
                    <button class="action-btn edit" onclick="openUpdateStockModal(${product.id})">Update Stock</button>
                    <button class="action-btn view" onclick="viewProduct(${product.id})">View Details</button> 
                </div>
            </td>
        `;
    });
}

// --- REPORTS PAGE ---
function renderReportsPage() {
    renderReportsSummaryCards();
    renderTopSellingProducts();
    renderMonthlySalesChart(); 
}

async function renderReportsSummaryCards() {
    const totalRevenue = sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
    const totalTransactions = sales.length;
    const itemsSoldCount = sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + parseInt(s.quantity), 0);
    const avgTransactionValue = totalTransactions > 0 ? (totalRevenue / totalTransactions) : 0;

    const container = document.getElementById('reportsSummaryCards');
     container.innerHTML = `
        <div class="stat-card"><h3>₹${totalRevenue.toFixed(2)}</h3><p>Total Revenue (Completed)</p></div>
        <div class="stat-card"><h3>${totalTransactions}</h3><p>Total Transactions</p></div>
        <div class="stat-card"><h3>${itemsSoldCount}</h3><p>Total Items Sold</p></div>
        <div class="stat-card"><h3>₹${avgTransactionValue.toFixed(2)}</h3><p>Avg. Transaction Value</p></div>
    `;
}

function renderTopSellingProducts() {
    const productSales = {};
    sales.filter(s => s.status === 'completed').forEach(sale => {
        if (!productSales[sale.productId]) {
            const product = products.find(p => p.id == sale.productId);
            productSales[sale.productId] = { name: product ? product.name : 'Unknown Product', unitsSold: 0, revenue: 0 };
        }
        productSales[sale.productId].unitsSold += parseInt(sale.quantity);
        productSales[sale.productId].revenue += parseFloat(sale.totalAmount);
    });

    const topProducts = Object.values(productSales)
                            .sort((a, b) => b.unitsSold - a.unitsSold) 
                            .slice(0, 10); 

    const tbody = document.getElementById('topSellingProductsTable').querySelector('tbody');
    tbody.innerHTML = '';
    if (topProducts.length === 0) {
         tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">No sales data available.</td></tr>`;
         return;
    }
    topProducts.forEach(p => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${p.name}</td>
            <td>${p.unitsSold}</td>
            <td>₹${p.revenue.toFixed(2)}</td>
        `;
    });
}

function renderMonthlySalesChart() {
    const ctx = document.getElementById('monthlySalesChart').getContext('2d');
    
    if (monthlySalesChartInstance) {
        monthlySalesChartInstance.destroy();
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const labels = [];
    const dataPoints = [];
    const today = new Date();

    for (let i = 5; i >= 0; i--) { 
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        labels.push(monthNames[d.getMonth()] + " " + d.getFullYear().toString().slice(-2)); 
        
        const monthlyRevenue = sales
            .filter(s => {
                const saleDate = new Date(s.date);
                return s.status === 'completed' && 
                       saleDate.getMonth() === d.getMonth() && 
                       saleDate.getFullYear() === d.getFullYear();
            })
            .reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
        dataPoints.push(monthlyRevenue);
    }

    monthlySalesChartInstance = new Chart(ctx, {
        type: 'line', 
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Sales Revenue (₹)',
                data: dataPoints,
                borderColor: '#FF7A00',
                backgroundColor: 'rgba(255, 122, 0, 0.2)',
                tension: 0.1,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    }
                }
            },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                     callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += '₹' + context.parsed.y.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}


// --- PROFILE MANAGEMENT ---
function loadProfileData() {
    if (currentUser) {
        document.getElementById('profileNameDisplay').textContent = currentUser.fullName;
        document.getElementById('profileRoleDisplay').textContent = 'Administrator';
        document.getElementById('profileEmailDisplay').textContent = currentUser.email;

        document.getElementById('profileFullName').value = currentUser.fullName;
        document.getElementById('profileEmail').value = currentUser.email;
        currentUser.phone = currentUser.phone || ''; // Ensure phone is not undefined
        currentUser.address = currentUser.address || ''; // Ensure address is not undefined
        document.getElementById('profilePhone').value = currentUser.phone;
        document.getElementById('profileRole').value = 'Administrator';
        document.getElementById('profileAddress').value = currentUser.address;
    }
}
function updateProfile(event) {
    event.preventDefault();
    if (currentUser) {
        currentUser.fullName = document.getElementById('profileFullName').value;
        currentUser.email = document.getElementById('profileEmail').value;
        currentUser.phone = document.getElementById('profilePhone').value;
        currentUser.address = document.getElementById('profileAddress').value;
        loadProfileData(); 
        showNotification('Profile updated successfully!', 'success');
    }
}
function changePassword(event) {
    event.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword.length < 6) {
         showNotification('New password must be at least 6 characters long.', 'error');
        return;
    }
    if (newPassword !== confirmPassword) {
        showNotification('New passwords do not match!', 'error');
        return;
    }
    showNotification('Password changed successfully! (Note: Login allows any password)', 'success');
    event.target.reset();
}

// --- UTILITY FUNCTIONS ---
function showNotification(message, type = 'info') {
    const notificationArea = document.body; 
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationArea.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10); 
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 500); 
    }, 3000);
}
