// Firebase Configuration
const firebaseConfig = {
    apiKey: 

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const secondaryApp = firebase.initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = secondaryApp.auth();

// Global Variables
let currentUser = null, currentRole = null, allTransactions = [], globalAdLink = "https://www.facebook.com", editingId = null;

// Helper Functions
function getDetailedDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    return now.toLocaleString('bn-BD', options);
}

async function fetchAdLink() {
    const doc = await db.collection('settings').doc('appConfig').get();
    if(doc.exists && doc.data().adLink) globalAdLink = doc.data().adLink;
}

function showToast(message, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = `toast ${type} show`;
    setTimeout(() => el.classList.remove('show'), 3000);
}

function showLoader(show) {
    let loader = document.getElementById('global-loader');
    if(show && !loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.className = 'loader-overlay';
        loader.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loader);
    } else if(!show && loader) {
        loader.remove();
    }
}

function formatBDT(amount) {
    return '৳ ' + Number(amount).toLocaleString('bn-BD');
}

function navigateTo(view) {
    ['dashboard', 'transactions', 'customers', 'customer'].forEach(id => {
        const viewEl = document.getElementById(id + '-view');
        const navEl = document.getElementr.classList.remove('hidden');
    
    let width = 0;
    const timer = setInterval(() => {
        if(width >= 100) {
            clearInterval(timer);
            sessionStorage.setItem('accountingAppUnlocked', 'true');
            document.getElementById('app-locker').classList.add('hidden');
            showToast("অ্যাপ আনলক হয়েছে, স্বাগতম!");
        } else {
            width++;
            progressBar.style.width = width + '%';
        }
    }, 60);
}

// Authentication Functions
async function loginUser() {
    showLoader(true);
    try {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        await auth.signInWithEmailAndPassword(email, password);
    } catch(e) {
        showToast("ভুল ইমেইল বা পাসওয়ার্ড!", "error");
        showLoader(false);
    }
}

async function signupUser() {
    showLoader(true);
    try {
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const name = document.getElementById('signup-name').value;
        const isAdmin = document.getElementById('is-admin').checked;
        
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(cred.user.uid).set({
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: name,
            role: isAdmin ? 'admin' : 'user',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        location.reload();
    } catch(e) {
        showToast("সাইন আপ ব্যর্থ হয়েছে!", "error");
        showLoader(false);
    }
}

// User Data Loading
async function loadUserData() {
    showLoader(true);
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (!userDoc.exists) {
            await auth.signOut();
            return;
        }
        
        const data = userDoc.data();
        currentRole = data.role;
        await fetchAdLink();
        
        // Switch screen from Auth to Main App
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        // Global UI Updates
        document.getElementById('user-avatar').textContent = (data.displayName || 'U').charAt(0).toUpperCase();
        document.getElementById('profile-name').textContent = data.displayName;
        document.getElementById('profile-email').textContent = data.email;
        
        // Ad Locker Trigger
        if (sessionStorage.getItem('accountingAppUnlocked') !== 'true') {
            document.getElementById('app-locker').classList.remove('hidden');
        } else {
            document.getElementById('app-locker').classList.add('hidden');
        }
        
        if (currentRole === 'admin') {
            document.getElementById('admin-nav').classList.remove('hidden');
            document.getElementById('admin-secret-section').classList.remove('hidden');
            navigateTo('dashboard');
            loadAdminData();
        } else {
            document.getElementById('admin-nav').classList.add('hidden');
            document.getElementById('admin-secret-section').classList.add('hidden');
            navigateTo('customer');
            loadCustomerData();
        }
    } catch(e) {
        console.error(e);
    }
    showLoader(false);
}

// Admin Functions
function loadAdminData() {
    db.collection('shopkeepers').doc(currentUser.uid).collection('transactions')
        .orderBy('date', 'desc')
        .onSnapshot(snapshot => {
            allTransactions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            renderAdminUI();
        });
    loadCustomersList();
}

function renderAdminUI() {
    let income = 0, expense = 0;
    allTransactions.forEach(t => {
        if(t.type === 'income') income += t.amount;
        else expense += t.amount;
    });
    
    document.getElementById('total-income').textContent = formatBDT(income);
    document.getElementById('total-expense').textContent = formatBDT(expense);
    document.getElementById('total-balance').textContent = formatBDT(income - expense);
    
    // Render transactions list
    document.getElementById('transactions-list').innerHTML = allTransactions.map(t => `
        <div class="glass-card p-4 rounded-2xl flex justify-between items-center group">
            <div class="flex-1">
                <p class="font-bold text-sm">${t.customerName}</p>
                <p class="text-[9px] text-gray-500">${t.description}</p>
                <p class="text-[8px] text-purple-600 font-medium mt-1"><i class="far fa-clock"></i> ${t.banglaDate || ''}</p>
            </div>
            <div class="flex items-center gap-3">
                <div class="text-right">
                    <p class="font-black text-sm ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}">
                        ${t.type === 'income' ? '+' : '-'}${formatBDT(t.amount)}
                    </p>
                </div>
                <div class="flex flex-col gap-1">
                    <button onclick="openEdit('${t.id}')" class="text-blue-500 text-xs p-1"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteTrans('${t.id}')" class="text-red-500 text-xs p-1"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `).join('');
    
    renderDashboardCustomers();
}

async function addTransaction() {
    const customerName = document.getElementById('trans-customer').value;
    const description = document.getElementById('trans-desc').value;
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const type = document.getElementById('trans-type').value;
    
    if(!customerName || !amount) return;
    
    await db.collection('shopkeepers').doc(currentUser.uid).collection('transactions').add({
        customerName: customerName,
        description: description,
        amount: amount,
        type: type,
        date: firebase.firestore.Timestamp.now(),
        banglaDate: getDetailedDate()
    });
    
    document.getElementById('trans-customer').value = '';
    document.getElementById('trans-amount').value = '';
    showToast("লেনদেন সফলভাবে যোগ হয়েছে");
}

function openEdit(id) {
    const transaction = allTransactions.find(x => x.id === id);
    editingId = id;
    document.getElementById('edit-desc').value = transaction.description;
    document.getElementById('edit-amount').value = transaction.amount;
    document.getElementById('edit-type').value = transaction.type;
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

async function saveEdit() {
    const description = document.getElementById('edit-desc').value;
    const amount = parseFloat(document.getElementById('edit-amount').value);
    const type = document.getElementById('edit-type').value;
    
    await db.collection('shopkeepers').doc(currentUser.uid)
        .collection('transactions').doc(editingId)
        .update({ description: description, amount: amount, type: type });
    
    closeEditModal();
    showToast("সফলভাবে আপডেট হয়েছে");
}

async function deleteTrans(id) {
    if(confirm("লেনদেনটি কি ডিলিট করতে চান?")) {
        await db.collection('shopkeepers').doc(currentUser.uid)
            .collection('transactions').doc(id).delete();
        showToast("লেনদেনটি ডিলিট করা হয়েছে", "error");
    }
}

async function loadCustomersList()                </div>
            </div>
        </div>
    `).join('');
    document.getElementById('customer-history-modal').classList.remove('hidden');
}

function closeHistoryModal() {
    document.getElementById('customer-history-modal').classList.add('hidden');
}

function showCreateCustomerModal() {
    document.getElementById('create-customer-modal').classList.remove('hidden');
}

function closeCreateCustomerModal() {
    document.getElementById('create-customer-modal').classList.add('hidden');
}

async function createCustomerAccount() {
    const name = document.getElementById('new-cust-name').value;
    const email = document.getElementById('new-cust-email').value;
    const password = document.getElementById('new-cust-pass').value;
    
    showLoader(true);
    try {
        const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(cred.user.uid).set({
            uid: cred.user.uid,
            email: email,
            displayName: name,
            role: 'user',
            createdBy: currentUser.uid
        });
        
