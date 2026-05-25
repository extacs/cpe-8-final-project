let currentImgB64 = null;

function openPostModal() {
    currentImgB64 = null;
    document.getElementById("imgPreview").style.display = "none";
    document.getElementById("uploadPlaceholder").style.display = "block";
    document.getElementById("uploadArea").classList.remove("has-img");
    ["p-title", "p-desc", "p-price", "p-contact"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    const freeToggle = document.getElementById("p-free");
    if (freeToggle) freeToggle.checked = false;
    const priceField = document.getElementById("p-price");
    if (priceField) priceField.disabled = false;
    const eventToggle = document.getElementById("p-event");
    if (eventToggle) eventToggle.checked = false;
    const eventLabel = document.getElementById("p-event-label");
    if (eventLabel) {
        eventLabel.style.display = "none";
    }
    document.getElementById("postModal").classList.add("open");
}

function closePostModal() {
    document.getElementById("postModal").classList.remove("open");
}



function previewImg(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast("Image must be under 5MB.");
        return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
        currentImgB64 = ev.target.result; /* data:image/jpeg;base64,... */
        const preview = document.getElementById("imgPreview");
        preview.src = currentImgB64;
        preview.style.display = "block";
        document.getElementById("uploadPlaceholder").style.display = "none";
        document.getElementById("uploadArea").classList.add("has-img");
    };
    reader.readAsDataURL(file);
}

function getCookie(name){
  let v=null;
  if(document.cookie) document.cookie.split(';').forEach(c=>{
    c=c.trim();
    if(c.startsWith(name+'=')) v=decodeURIComponent(c.slice(name.length+1));
  });
  return v;
}


function switchStaffTab(tab){
  document.querySelectorAll('.stab').forEach(b=>{ b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
  document.querySelectorAll('.stab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.getElementById('tab-'+tab).setAttribute('aria-selected','true');
  document.getElementById('stab-'+tab).classList.add('active');
}

function filterOrders(btn, status){
  document.querySelectorAll('.fbar-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.order-card').forEach(card=>{
    card.style.display = (status==='all' || card.dataset.status===status) ? '' : 'none';
  });
}

function updateOrderStatus(orderId, newStatus, btn){
  btn.disabled = true;
  btn.textContent = '⏳...';
  fetch(API_URLS.updateOrderStatus, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'X-CSRFToken': getCookie('csrftoken') },
    body: JSON.stringify({ order_id: orderId, status: newStatus })
  })
  .then(r=>r.json())
  .then(data=>{
    if(data.ok){
      showToast(data.order_number + ' marked as ' + newStatus.toUpperCase());
      setTimeout(()=>window.location.reload(), 800);
    } else {
      showToast('Error: ' + (data.error||'Failed'));
      btn.disabled = false;
    }
  })
  .catch(()=>{ showToast('Connection error.'); btn.disabled=false; });
}


function updateStock(itemId, stockStatus, rowId){
  const restockInput = document.getElementById('restock-'+rowId);
  const restockDate  = restockInput ? restockInput.value : null;

  if(restockInput){
    restockInput.style.opacity = stockStatus==='oos' ? '1' : '.3';
  }

  fetch(API_URLS.updateStock, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'X-CSRFToken': getCookie('csrftoken') },
    body: JSON.stringify({
      item_id: itemId,
      stock_status: stockStatus,
      restock_date: restockDate || null
    })
  })
  .then(r=>r.json())
  .then(data=>{
    if(data.ok){
      showToast('Stock updated.');
    } else {
      showToast('Error: ' + (data.error||'Failed'));
    }
  })
  .catch(()=>showToast('Connection error.'));
}


function saveNewItem(){
  const name   = document.getElementById('newName').value.trim();
  const current_imgB64  = currentImgB64;
  const cat    = document.getElementById('newCat').value;
  const status = document.getElementById('newStatus').value;
  const sizes  = document.getElementById('newSizes').value.trim();
  const desc   = document.getElementById('newDesc').value.trim();
  const restock = document.getElementById('newRestock').value || null;

  if(!name){ showToast('Item name is required.'); return; }
  fetch(API_URLS.saveItem, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'X-CSRFToken': getCookie('csrftoken') },
    body: JSON.stringify({
      item_id: null, 
      name, 
      image_base64: current_imgB64, 
      category: cat,
      stock_status: status,
      sizes, 
      description: desc, 
      restock_date: restock
    })
  })
  .then(r=>r.json())
  .then(data=>{
    if(data.ok){
      showToast(data.name + ' added to catalog!');
      setTimeout(()=>window.location.reload(), 900);
    } else {
      showToast('Error: ' + (data.error||'Failed'));
    }
  })
  .catch(()=>showToast('Connection error.'));
}

function clearNewItemForm(){
  ['newName','newEmoji','newSizes','newDesc','newRestock'].forEach(id=>{
    document.getElementById(id).value='';
  });
  document.getElementById('newCat').value='uniform';
  document.getElementById('newStatus').value='in_stock';
}


function deleteItem(itemId, btn){
  if(!confirm('Remove this item from the catalog?')) return;
  btn.disabled=true;
  fetch(API_URLS.deleteItem, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'X-CSRFToken': getCookie('csrftoken') },
    body: JSON.stringify({ item_id: itemId })
  })
  .then(r=>r.json())
  .then(data=>{
    if(data.ok){
      const row=document.getElementById('inv-row-'+itemId);
      if(row) row.style.opacity='0.3';
      showToast('Item removed from catalog.');
    } else {
      showToast('Error: '+(data.error||'Failed'));
      btn.disabled=false;
    }
  })
  .catch(()=>{ showToast('Connection error.'); btn.disabled=false; });
}

