// Chart.js must be loaded in the HTML for this to work.
// Make sure your HTML includes:
// <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
// and a canvas element:
// <canvas id="transactions-chart" width="400" height="200"></canvas>
// The chart is rendered in the renderChart() function, which uses the canvas element with id 'transactions-chart'

// Element references
const app = document.getElementById('app');
const loginRegisterPage = document.getElementById('login-register-page');
const userGreeting = document.getElementById('user-greeting');
const logoutBtn = document.getElementById('logout-btn');

// Navigation elements
const navLinks = document.querySelectorAll('nav#sidebar ul li a[data-page]');
const pages = document.querySelectorAll('section.page');
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const headerToggleBtn = document.getElementById('header-toggle-btn');
const pageTitle = document.getElementById('page-title');

// Transaction elements
const txnForm = document.querySelector('.transaction-form');
const txnTableBody = document.getElementById('txn-table-body');
const txnDate = document.getElementById('txn-date');
const txnType = document.getElementById('txn-type');
const txnDescription = document.getElementById('txn-description');
const txnAmount = document.getElementById('txn-amount');
const txnSubmitBtn = document.getElementById('txn-submit-btn');

// Login/Register form elements
const formTitle = document.getElementById('form-title');
const loginForm = document.getElementById('login-form');
const toggleToRegisterLink = document.getElementById('toggle-to-register');
const loginError = document.getElementById('login-error');

// State variables
let isRegisterMode = false;
let editTransactionId = null;

// LocalStorage keys
const AUTH_KEY = 'financeAppAuth';
const TXN_KEY = 'financeAppTransactions';
const USERS_KEY = 'financeAppUsers';

// Chart instance
let transactionsChart = null;

// Utility: format number as USD currency string
function formatCurrency(amount) {
    const options = { style: 'currency', currency: 'USD' };
    return amount.toLocaleString('en-US', options);
}

// Utility: generate simple unique ID
function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

// Show page by ID, update nav active state and page title
function showPage(pageId) {
    pages.forEach(page => {
        if (page.id === pageId) {
            page.style.display = '';
            page.setAttribute('aria-hidden', 'false');
            page.focus();
        } else {
            page.style.display = 'none';
            page.setAttribute('aria-hidden', 'true');
        }
    });
    navLinks.forEach(link => {
        if (link.dataset.page === pageId) {
            link.classList.add('active');
            pageTitle.textContent = link.querySelector('span.text').textContent;
        } else {
            link.classList.remove('active');
        }
    });
}

// Load transactions from localStorage
function getTransactions() {
    const data = localStorage.getItem(TXN_KEY);
    return data ? JSON.parse(data) : [];
}

// Save transactions to localStorage
function saveTransactions(txns) {
    localStorage.setItem(TXN_KEY, JSON.stringify(txns));
}

// Update dashboard metrics and values
function updateDashboard(metrics = null) {
    if (!metrics) {
        metrics = { cashOnHand: 0, cashOut: 0, accountPayable: 0, accountReceive: 0 };
        getTransactions().forEach(t => {
            const amount = parseFloat(t.amount);
            if (metrics.hasOwnProperty(t.type)) {
                metrics[t.type] += amount;
            }
        });
    }

    document.getElementById('cash-on-hand-amount').textContent = formatCurrency(metrics.cashOnHand);
    document.getElementById('cash-out-amount').textContent = formatCurrency(metrics.cashOut);
    document.getElementById('account-payable-amount').textContent = formatCurrency(metrics.accountPayable);
    document.getElementById('account-receive-amount').textContent = formatCurrency(metrics.accountReceive);

    const balance = metrics.cashOnHand + metrics.accountReceive - metrics.cashOut - metrics.accountPayable;
    document.getElementById('balance-amount').textContent = formatCurrency(balance);

    const totalRevenue = metrics.cashOnHand + metrics.accountReceive;
    const totalExpenses = metrics.cashOut + metrics.accountPayable;
    const netResult = totalRevenue - totalExpenses;

    if (netResult >= 0) {
        document.getElementById('net-income-amount').textContent = formatCurrency(netResult);
        document.getElementById('net-loss-amount').textContent = '$0.00';
    } else {
        document.getElementById('net-income-amount').textContent = '$0.00';
        document.getElementById('net-loss-amount').textContent = formatCurrency(Math.abs(netResult));
    }
}

// Escape HTML special characters to prevent XSS
function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Truncate string with ellipsis if longer than given length
function truncateString(str, maxLength) {
    return str.length > maxLength ? str.slice(0, maxLength) + '…' : str;
}

// Map transaction type keys to readable labels
function transactionTypeLabel(type) {
    const labels = { cashOnHand: 'Cash On Hand', cashOut: 'Cash Out', accountPayable: 'Account Payable', accountReceive: 'Account Receive' };
    return labels[type] || 'Unknown';
}

// Render transactions table rows
function renderTransactions() {
    const txns = getTransactions().sort((a, b) => new Date(b.date) - new Date(a.date));
    txnTableBody.innerHTML = '';

    if (txns.length === 0) {
        txnTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;opacity:0.7;">No transactions yet.</td></tr>';
        return;
    }

    txns.forEach(t => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', t.id);
        tr.innerHTML = `
            <td>${t.date}</td>
            <td>${transactionTypeLabel(t.type)}</td>
            <td title="${escapeHtml(t.description)}">${truncateString(t.description, 30)}</td>
            <td>${formatCurrency(parseFloat(t.amount))}</td>
            <td class="actions" aria-label="Actions">
                <button class="edit" aria-label="Edit transaction"><i class="fas fa-edit"></i></button>
                <button class="delete" aria-label="Delete transaction"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        txnTableBody.appendChild(tr);
    });
}

// Clear transaction form fields
function clearTransactionForm() {
    txnDate.value = '';
    txnType.value = '';
    txnDescription.value = '';
    txnAmount.value = '';
    txnSubmitBtn.textContent = 'Add Transaction';
    editTransactionId = null;
}

// Add or update transaction from form submission
function submitTransaction(e) {
    e.preventDefault();
    if (!txnDate.value || !txnType.value || !txnDescription.value.trim() || !txnAmount.value) {
        alert('Please fill all transaction fields.');
        return;
    }

    let txns = getTransactions();

    const newTxn = {
        id: editTransactionId || generateId(),
        date: txnDate.value,
        type: txnType.value,
        description: txnDescription.value.trim(),
        amount: parseFloat(txnAmount.value).toFixed(2)
    };

    if (editTransactionId) {
        const idx = txns.findIndex(t => t.id === editTransactionId);
        if (idx !== -1) {
            txns[idx] = newTxn;
        }
        editTransactionId = null;
    } else {
        txns.push(newTxn);
    }

    saveTransactions(txns);
    renderTransactions();
    updateDashboard();
    clearTransactionForm();
    alert('Transaction saved successfully.');
}

// Edit transaction by ID, populate form for editing
function editTransaction(id) {
    const txns = getTransactions();
    const txn = txns.find(t => t.id === id);
    if (!txn) {
        alert('Transaction not found.');
        return;
    }
    txnDate.value = txn.date;
    txnType.value = txn.type;
    txnDescription.value = txn.description;
    txnAmount.value = txn.amount;
    txnSubmitBtn.textContent = 'Update Transaction';
    editTransactionId = id;
    showPage('transactions');
}

// Delete transaction by ID
function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    let txns = getTransactions();
    txns = txns.filter(t => t.id !== id);
    saveTransactions(txns);
    renderTransactions();
    updateDashboard();
}

// Render the transactions chart using Chart.js
function renderChart() {
    const txns = getTransactions();
    const types = ['cashOnHand', 'cashOut', 'accountPayable', 'accountReceive'];
    const sums = { cashOnHand: 0, cashOut: 0, accountPayable: 0, accountReceive: 0 };

    txns.forEach(t => {
        if (sums.hasOwnProperty(t.type)) {
            sums[t.type] += parseFloat(t.amount);
        }
    });

    const data = {
        labels: ['Cash On Hand', 'Cash Out', 'Account Payable', 'Account Receive'],
        datasets: [{
            label: 'Transaction Amounts (USD)',
            data: types.map(t => sums[t]),
            backgroundColor: [
                'rgba(41, 128, 185, 0.7)',
                'rgba(231, 76, 60, 0.7)',
                'rgba(155, 89, 182, 0.7)',
                'rgba(39, 174, 96, 0.7)'
            ],
            borderColor: [
                'rgba(41, 128, 185, 1)',
                'rgba(231, 76, 60, 1)',
                'rgba(155, 89, 182, 1)',
                'rgba(39, 174, 96, 1)'
            ],
            borderWidth: 1
        }]
    };

    const config = {
        type: 'bar',
        data,
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: context => formatCurrency(context.parsed.y ?? context.parsed)
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => '$' + v }
                }
            }
        }
    };

    const ctx = document.getElementById('transactions-chart').getContext('2d');
    if (transactionsChart) {
        transactionsChart.destroy();
    }
    transactionsChart = new Chart(ctx, config);
}

// Toggle sidebar for desktop and mobile
function toggleSidebar() {
    if (window.innerWidth > 768) {
        sidebar.classList.toggle('collapsed');
    } else {
        document.body.classList.toggle('menu-open');
    }
}

// Close menu on link click on mobile
function closeMenuMobile() {
    if (window.innerWidth <= 768) {
        document.body.classList.remove('menu-open');
    }
}

// User management utilities
function getUsers() {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function registerUser(email, password) {
    const users = getUsers();
    if (users.find(u => u.email === email.toLowerCase())) {
        return false; // Already registered
    }
    users.push({ email: email.toLowerCase(), password });
    saveUsers(users);
    return true;
}

function authenticateUser(email, password) {
    const users = getUsers();
    return users.find(u => u.email === email.toLowerCase() && u.password === password);
}

function saveAuth(email) {
    localStorage.setItem(AUTH_KEY, email.toLowerCase());
}

function clearAuth() {
    localStorage.removeItem(AUTH_KEY);
}

function getAuth() {
    return localStorage.getItem(AUTH_KEY);
}

function updateUserGreeting() {
    const user = getAuth();
    if (user) {
        userGreeting.innerHTML = `<i class="fas fa-user-circle"></i> ${user}`;
    } else {
        userGreeting.textContent = '';
    }
}

// Event listeners for navigation links
navLinks.forEach(link => {
    link.addEventListener('click', e => {
        const page = link.dataset.page;
        if (page) {
            e.preventDefault();
            showPage(page);
            closeMenuMobile();
            if (page === 'transactions') {
                renderTransactions();
            } else if (page === 'dashboard') {
                updateDashboard();
            } else if (page === 'charts') {
                renderChart();
            }
        }
    });
});

// Sidebar toggle button
sidebarToggleBtn.addEventListener('click', e => {
    e.preventDefault();
    toggleSidebar();
});

// Header toggle button, if exists
headerToggleBtn && headerToggleBtn.addEventListener('click', e => {
    e.preventDefault();
    toggleSidebar();
});

// Transaction form submission
txnForm.addEventListener('submit', submitTransaction);

// Transaction table buttons for edit/delete
txnTableBody.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = tr?.getAttribute('data-id');
    if (!id) return;

    if (btn.classList.contains('edit')) {
        editTransaction(id);
    } else if (btn.classList.contains('delete')) {
        deleteTransaction(id);
    }
});

// Logout button
logoutBtn.addEventListener('click', e => {
    e.preventDefault();
    clearAuth();
    location.reload();
});

// Toggle between login and register modes
toggleToRegisterLink.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    if (isRegisterMode) {
        formTitle.textContent = 'Register';
        loginForm.innerHTML = `
            <label for="reg-email">Email</label>
            <input type="email" id="reg-email" required autocomplete="email" />
            <label for="reg-password">Password</label>
            <input type="password" id="reg-password" required autocomplete="new-password" />
            <label for="reg-password-confirm">Confirm Password</label>
            <input type="password" id="reg-password-confirm" required autocomplete="new-password" />
            <button type="submit">Register</button>
        `;
        toggleToRegisterLink.textContent = 'Already have an account? Login';
        loginError.style.display = 'none';
    } else {
        formTitle.textContent = 'Login';
        loginForm.innerHTML = `
            <label for="login-email">Email</label>
            <input type="email" id="login-email" required autocomplete="username" />
            <label for="login-password">Password</label>
            <input type="password" id="login-password" required autocomplete="current-password" />
            <button type="submit">Log In</button>
        `;
        toggleToRegisterLink.textContent = "Don't have an account? Register";
        loginError.style.display = 'none';
    }
});

// Login/Register form submission handling
loginRegisterPage.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    loginError.style.display = 'none';

    if (isRegisterMode) {
        // Register flow
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const passwordConfirm = document.getElementById('reg-password-confirm').value;

        if (password !== passwordConfirm) {
            loginError.textContent = 'Passwords do not match.';
            loginError.style.display = 'block';
            return;
        }
        if (password.length < 6) {
            loginError.textContent = 'Password must be at least 6 characters.';
            loginError.style.display = 'block';
            return;
        }
        if (!email || !password) {
            loginError.textContent = 'Email and password are required.';
            loginError.style.display = 'block';
            return;
        }
        if (!registerUser(email, password)) {
            loginError.textContent = 'Email is already registered.';
            loginError.style.display = 'block';
            return;
        }
        alert('Registration successful! You can now log in.');
        toggleToRegisterLink.click(); // Switch back to login mode
    } else {
        // Login flow
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const authUser = authenticateUser(email, password);

        if (authUser) {
            saveAuth(email);
            loginRegisterPage.style.display = 'none';
            app.style.display = 'flex';
            initializeApp();
        } else {
            loginError.textContent = 'Invalid email or password.';
            loginError.style.display = 'block';
        }
    }
});

// Initialize app for logged-in users
function initializeApp() {
    updateUserGreeting();
    updateDashboard();
    renderTransactions();
    renderChart();
    showPage('dashboard');

    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
    } else {
        sidebar.classList.remove('collapsed');
    }
}

// On page load, check auth state and show login or app
window.addEventListener('load', () => {
    if (getAuth()) {
        loginRegisterPage.style.display = 'none';
        app.style.display = 'flex';
        initializeApp();
    } else {
        loginRegisterPage.style.display = 'flex';
        app.style.display = 'none';
    }
});

// Responsive behavior: remove mobile menu open class on resize > 768px
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        document.body.classList.remove('menu-open');
        sidebar.classList.remove('collapsed');
    }
});

