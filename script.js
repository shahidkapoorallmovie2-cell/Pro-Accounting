// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDTnuxZ5vINwvvALc888hWvn6hGF39XV84",
    authDomain: "pro-accounting-2a806.firebaseapp.com",
    databaseURL: "https://pro-accounting-2a806-default-rtdb.firebaseio.com",
    projectId: "pro-accounting-2a806",
    storageBucket: "pro-accounting-2a806.firebasestorage.app",
    messagingSenderId: "1026296934241",
    appId: "1:1026296934241:web:e170860e2287e02fe35f20",
    measurementId: "G-4DS451640P"
};

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
        const navEl = document.getElementById('nav-' + id);
        if(viewEl) viewEl.classList.add('hidden');
        if(navEl) navEl.classList.remove('nav-active');
    });
    
    document.getElementById(view + '-view').classList.remove('hidden');
    const activeNav = document.getElementById('nav-' + view);
    if(activeNav) activeNav.classList.add('nav-active');
}

function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
}

function toggleProfileMenu() {
    document.getElementById('profile-menu').classList.toggle('hidden');
}

async function logout() {
    await auth.signOut();
    sessionStorage.clear();
    location.reload();
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    
    loginForm.classList.toggle('hidden', tab !== 0);
    signupForm.classList.toggle('hidden', tab === 0);
    loginTab.classList.toggle('nav-active', tab === 0);
    signupTab.classList.toggle('nav-active', tab !== 0);
}

// App Unlock Logic
function startAppUnlock() {
    window.open(globalAdLink, '_blank');
    const progContainer = document.getElementById('appProgressContainer');
    const progressBar = document.getElementById('appProgressBar');
    const unlockBtn = document.getElementById('appUnlockBtn');
    
    unlockBtn.disabled = true;
    progContainer.classList.remove('hidden');
    
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

async function loadCustomersList() {
    const snapshot = await db.collection('users')
        .where('role', '==', 'user')
        .where('createdBy', '==', currentUser.uid)
        .get();
    
    const customers = snapshot.docs.map(doc => doc.data());
    
    document.getElementById('customers-grid').innerHTML = customers.map(c => `
        <div class="glass-card p-4 rounded-2xl cursor-pointer" onclick="viewCustomerHistory('${c.displayName}')">
            <p class="font-bold text-sm">${c.displayName}</p>
            <p class="text-[10px] text-gray-500">${c.email}</p>
        </div>
    `).join('');
    
    document.getElementById('customer-suggestions').innerHTML = customers.map(c => 
        `<option value="${c.displayName}">`
    ).join('');
}

function renderDashboardCustomers() {
    const summary = {};
    allTransactions.forEach(t => {
        if(!summary[t.customerName]) summary[t.customerName] = { inc: 0, exp: 0 };
        if(t.type === 'income') summary[t.customerName].inc += t.amount;
        else summary[t.customerName].exp += t.amount;
    });
    
    document.getElementById('dashboard-customers-grid').innerHTML = Object.keys(summary).map(name => `
        <div class="glass-card p-4 rounded-2xl" onclick="viewCustomerHistory('${name}')">
            <p class="font-bold text-sm text-purple-600">${name}</p>
            <p class="text-xs font-black">ব্যালেন্স: ${formatBDT(summary[name].inc - summary[name].exp)}</p>
        </div>
    `).join('');
}

// Customer Functions
async function loadCustomerData() {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data();
    document.getElementById('customer-name-display').textContent = userData.displayName;
    
    const shops = await db.collection('shopkeepers').get();
    let myTransactions = [];
    
    for (const shop of shops.docs) {
        const querySnapshot = await db.collection('shopkeepers').doc(shop.id)
            .collection('transactions')
            .where('customerName', '==', userData.displayName)
            .get();
        querySnapshot.forEach(doc => myTransactions.push(doc.data()));
    }
    
    let income = 0, expense = 0;
    myTransactions.forEach(t => {
        if(t.type === 'income') income += t.amount;
        else expense += t.amount;
    });
    
    document.getElementById('cust-income').textContent = formatBDT(income);
    document.getElementById('cust-expense').textContent = formatBDT(expense);
    document.getElementById('cust-balance').textContent = formatBDT(income - expense);
    
    document.getElementById('customer-transactions').innerHTML = myTransactions
        .sort((a, b) => b.date - a.date)
        .map(t => `
            <div class="glass-card p-4 rounded-2xl flex justify-between">
                <div>
                    <p class="font-bold text-xs">${t.description}</p>
                    <p class="text-[8px] text-gray-400">${t.banglaDate || ''}</p>
                </div>
                <div class="${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'} font-bold text-xs">
                    ${formatBDT(t.amount)}
                </div>
            </div>
        `).join('');
}

// Modal Functions
window.viewCustomerHistory = (name) => {
    const filtered = allTransactions.filter(t => t.customerName === name);
    document.getElementById('history-modal-title').textContent = name;
    document.getElementById('history-modal-list').innerHTML = filtered.map(t => `
        <div class="p-3 border-b text-xs flex justify-between items-center">
            <div>
                <span class="block font-medium">${t.description}</span>
                <span class="text-[8px] text-gray-400">${t.banglaDate || ''}</span>
            </div>
            <div class="flex items-center gap-3">
                <span class="${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'} font-bold">
                    ${formatBDT(t.amount)}
                </span>
                <div class="flex gap-1">
                    <button onclick="openEdit('${t.id}')" class="text-blue-500"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteTrans('${t.id}')" class="text-red-500"><i class="fas fa-trash"></i></button>
                </div>
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
        await secondaryAuth.signOut();
        showToast("কাস্টমার অ্যাকাউন্ট তৈরি হয়েছে");
        closeCreateCustomerModal();
        loadCustomersList();
    } catch(err) {
        showToast(err.message, "error");
    }
    showLoader(false);
}

// Admin Settings Functions
function unlockAdSettings() {
    const code = document.getElementById('master-unlock-code').value;
    if(code === "BADhon223466") {
        document.getElementById('ad-settings-unlocked').classList.remove('hidden');
    } else {
        showToast("ভুল কোড!", "error");
    }
}

async function saveAdLink() {
    const link = document.getElementById('ad-link-input').value;
    await db.collection('settings').doc('appConfig').set({ adLink: link }, { merge: true });
    showToast("অ্যাড লিংক সেভ হয়েছে");
}

// Auth State Listener
auth.onAuthStateChanged(user => {
    if(user) {
        currentUser = user;
        loadUserData();
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
        document.getElementById('app-locker').classList.add('hidden');
    }
});
