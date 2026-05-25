let cart = [];
let currentCat = 'all';


function showPanel(name) {
    document.querySelectorAll('.page-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + name).classList.add('active');
    window.scrollTo(0, 0);
}


function selectSize(btn) {
    btn.closest('.size-row').querySelectorAll('.size-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
}


function setCat(btn, cat) {
    document.querySelectorAll('.fb').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    currentCat = cat;
    filterProducts();
}

function filterProducts() {
    const q = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('.prod-card').forEach(c => {
        const nameMatch = c.dataset.name.includes(q);
        const catMatch  = currentCat === 'all' || c.dataset.cat === currentCat;
        c.style.display = (nameMatch && catMatch) ? '' : 'none';
    });
}


function addToCart(btn, name, cat) {
    const sizeBtn = btn.closest('.prod-card').querySelector('.size-btn.active');
    const size    = sizeBtn ? sizeBtn.textContent.trim() : '';
    const label   = size ? `${name} — ${size}` : name;

    cart.push({ id: Date.now(), name: label, rawName: name, cat: cat, size: size });
    btn.classList.add('added');
    btn.textContent = '✓ ADDED';
    setTimeout(() => {
        btn.classList.remove('added');
        btn.textContent = '▶ ADD TO CART';
    }, 1800);
    updateCartUI();
    showToast(label + ' added to cart');
}


function removeFromCart(id) {
    cart = cart.filter(i => i.id !== id);
    updateCartUI();
}


function updateCartUI() {
    const count = cart.length;

    document.getElementById('cartCount').textContent = count;
    document.getElementById('cartCount').setAttribute('aria-label', count + ' items in cart');

    const checkoutBtn = document.getElementById('checkoutBtn');
    checkoutBtn.disabled = count === 0;
    checkoutBtn.setAttribute('aria-disabled', count === 0);

    const placeBtn = document.getElementById('placeBtn');
    placeBtn.disabled = count === 0;
    placeBtn.setAttribute('aria-disabled', count === 0);

    document.getElementById('panelCount').textContent = count + ' ITEM' + (count !== 1 ? 'S' : '');
    document.getElementById('sumItems').textContent   = count;
    document.getElementById('sumTotal').textContent   = count;

    const emptyDrawer = document.getElementById('cartEmptyDrawer');
    const sumEl       = document.getElementById('cartSummary');
    const itemsEl     = document.getElementById('cartItems');
    itemsEl.querySelectorAll('.cart-item').forEach(e => e.remove());

    if (count === 0) {
        emptyDrawer.style.display = 'block';
        sumEl.style.display = 'none';
    } else {
        emptyDrawer.style.display = 'none';
        sumEl.style.display = 'block';
        const icons = { uniform: '👕', id: '🪪', supplies: '📄' };
        cart.forEach(item => {
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <span class="ci-icon" aria-hidden="true">${icons[item.cat] || '📦'}</span>
                <div class="ci-body">
                    <p class="ci-name">${item.name}</p>
                    <p class="ci-meta">BAO Office · Claim on-site</p>
                </div>
                <button class="ci-remove" onclick="removeFromCart(${item.id})"
                        aria-label="Remove ${item.name}">✕</button>`;
            itemsEl.appendChild(div);
        });
        document.getElementById('itemCount').textContent  = count;
        document.getElementById('totalItems').textContent = count;
    }

    const wrap  = document.getElementById('cartRowsWrap');
    const empty = document.getElementById('emptyState');
    wrap.querySelectorAll('.cart-row').forEach(r => r.remove());
    if (count === 0) {
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        const icons = { uniform: '👕', id: '🪪', supplies: '📄' };
        cart.forEach(item => {
            const div = document.createElement('div');
            div.className = 'cart-row';
            div.innerHTML = `
                <span class="cr-icon" aria-hidden="true">${icons[item.cat] || '📦'}</span>
                <div class="cr-body">
                    <p class="cr-name">${item.name}</p>
                    <p class="cr-meta">Claim at BAO Counter · On-site pickup</p>
                </div>
                <button class="cr-remove" onclick="removeFromCart(${item.id})"
                        aria-label="Remove ${item.name}">✕</button>`;
            wrap.insertBefore(div, empty);
        });
    }
}


function toggleCart() {
    const d    = document.getElementById('cartDrawer');
    const ov   = document.getElementById('drawerOverlay');
    const btn  = document.getElementById('cartBtn');
    const open = d.classList.toggle('open');
    ov.classList.toggle('show', open);
    btn.setAttribute('aria-expanded', open);
}


function goToCart() {
    if (cart.length === 0) return;
    toggleCart();
    showPanel('cart');
}

function getCookie(name) {
    let val = null;
    if (document.cookie) {
        document.cookie.split(';').forEach(c => {
            c = c.trim();
            if (c.startsWith(name + '=')) val = decodeURIComponent(c.slice(name.length + 1));
        });
    }
    return val;
}

function placeOrder() {
    if (cart.length === 0) return;

    const placeBtn = document.getElementById('placeBtn');
    placeBtn.disabled = true;
    placeBtn.textContent = '⏳ PLACING ORDER...';

    const note = (document.getElementById('orderNote').value || '').trim();

    const items = cart.map(item => ({
        name:     item.name,
        category: item.cat,
        size:     item.size || '',
    }));

    fetch('/bao/place-order/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken':  getCookie('csrftoken'),
        },
        body: JSON.stringify({ items: items, note: note }),
    })
    .then(res => res.json())
    .then(data => {
        if (!data.ok) {
            showToast('Order failed: ' + (data.error || 'Unknown error'));
            placeBtn.disabled    = false;
            placeBtn.textContent = '▶ PLACE ORDER & GENERATE FORM';
            return;
        }

        const orderNum = data.order_number;
        document.getElementById('orderIdDisplay').textContent = 'ORDER ' + orderNum;
        document.getElementById('formOrderId').textContent    = 'ORDER ' + orderNum;
        document.getElementById('orderDate').textContent      = data.placed_at;
        document.getElementById('genTimestamp').textContent   = data.placed_at;

        const studentId   = document.body.dataset.studentId   || '—';
        const studentName = document.body.dataset.studentName || '—';
        const studentSec  = document.body.dataset.studentSec  || '—';

        const idField = document.getElementById('slipStudentId');
        const secField = document.getElementById('slipStudentSec');
        if (idField)  idField.textContent  = studentId;
        if (secField) secField.textContent = studentSec;

        const catLabels = { uniform: 'Uniform', id: 'ID / Lace', supplies: 'Supplies' };
        const tbody = document.getElementById('formItemsTbody');
        tbody.innerHTML = '';
        cart.forEach((item, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="item-num">${String(i + 1).padStart(2, '0')}</span></td>
                <td>${item.name}</td>
                <td>${catLabels[item.cat] || item.cat}</td>
                <td>1</td>`;
            tbody.appendChild(tr);
        });

        cart = [];
        updateCartUI();
        showPanel('confirmation');
    })
    .catch(err => {
        console.error('BAO order error:', err);
        showToast('Connection error. Please try again.');
        placeBtn.disabled    = false;
        placeBtn.textContent = '▶ PLACE ORDER & GENERATE FORM';
    });
}
