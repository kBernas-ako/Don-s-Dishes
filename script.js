// Don's Dishes - Dynamic Menu & Editor

const STORAGE_KEY = 'donsDishesMenu_v1';
const ADMIN_PASS_KEY = 'donsDishesAdminPass_v1';
const SESSION_KEY = 'donsDishesAdminSession';
const DEFAULT_PASSWORD = (window.APP_CONFIG && window.APP_CONFIG.DEFAULT_PASSWORD) ? window.APP_CONFIG.DEFAULT_PASSWORD : '';

const DEFAULT_MENU = {
  version: 1,
  lastUpdated: null,
  categories: [
    {
      category: 'ULAM',
      items: [
        { name: 'Adobo', description: 'Savory chicken or pork simmered in soy sauce, vinegar, garlic, and peppercorns.', price: 50, image: '' },
        { name: 'Sinigang', description: 'Comforting sour soup made with tamarind, fresh vegetables, and your choice of meat.', price: 50, image: '' },
        { name: 'Fried Chicken', description: 'Crispy, golden-fried chicken — a classic favorite.', price: 60, image: '' },
        { name: 'Giniling', description: 'Ground pork stewed in tomato sauce with potatoes and carrots.', price: 45, image: '' },
        { name: 'Ginatan', description: 'Sweet coconut milk stew with saba bananas and sticky rice balls.', price: 35, image: '' },
        { name: 'Dinuguan', description: 'Rich and savory pork blood stew, best paired with puto.', price: 40, image: '' },
        { name: 'Kalabasa', description: 'Fresh squash simmered with malunggay in a light broth.', price: 25, image: '' }
      ]
    },
    {
      category: 'DRINKS',
      items: [
        { name: 'Softdrinks', description: 'Chilled bottled softdrinks.', price: 20, image: '' },
        { name: 'Water', description: 'A refreshing glass or bottle of water.', price: 15, image: '' }
      ]
    }
  ]
};

let menu = loadMenu();
let pendingImage = '';
let editingRef = null;

document.addEventListener('DOMContentLoaded', () => {
  renderMenu();
  renderAdminList();
  populateCategorySelect();
  bindNav();
  bindEvents();
});

// ---------- storage ----------

function loadMenu() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.categories)) return parsed;
    }
  } catch (err) { /* ignore, fall back to defaults */ }
  return JSON.parse(JSON.stringify(DEFAULT_MENU));
}

function saveMenu() {
  try {
    menu.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(menu));
    renderLastUpdated();
  } catch (err) {
    alert('Could not save the menu. Browser storage is full — try smaller photos.');
  }
}

// ---------- helpers ----------

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 700;
        let width = img.width;
        let height = img.height;
        if (width > MAX) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => reject(new Error('invalid image'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('read error'));
    reader.readAsDataURL(file);
  });
}

// ---------- admin auth ----------

let passHashPromise = null;

function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

function ensurePassHash() {
  if (!passHashPromise) {
    passHashPromise = (async () => {
      const stored = localStorage.getItem(ADMIN_PASS_KEY);
      if (stored) return stored;
      const h = await hashPassword(DEFAULT_PASSWORD);
      localStorage.setItem(ADMIN_PASS_KEY, h);
      return h;
    })();
  }
  return passHashPromise;
}

function hashPassword(pw) {
  return sha256(pw + '|dons_dishes_salt_v1');
}

function sha256(text) {
  if (window.crypto && window.crypto.subtle) {
    return window.crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(text))
      .then((buf) => {
        const bytes = new Uint8Array(buf);
        let hex = '';
        for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
        return hex;
      });
  }
  return Promise.resolve(simpleHash(text));
}

function simpleHash(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16) +
    (4294967296 * (2097151 & (h1 >>> 0)) + (h2 >>> 0)).toString(16)
  );
}

// ---------- public menu rendering ----------

function renderMenu() {
  const box = document.getElementById('menuBox');
  box.innerHTML = '';

  if (!menu.categories.length) {
    box.innerHTML = '<p class="admin-empty">No menu items yet. Click "Edit Menu" to add some.</p>';
    renderLastUpdated();
    return;
  }

  menu.categories.forEach((cat, ci) => {
    const catDiv = document.createElement('div');
    catDiv.className = 'menu-category';

    const h3 = document.createElement('h3');
    h3.className = 'category-title';
    h3.textContent = cat.category;
    catDiv.appendChild(h3);

    const ul = document.createElement('ul');
    ul.className = 'menu-list';

    if (!cat.items.length) {
      const li = document.createElement('li');
      li.className = 'menu-empty';
      li.textContent = 'No items available today.';
      ul.appendChild(li);
    } else {
      cat.items.forEach((item, ii) => ul.appendChild(createItemEl(ci, ii, item)));
    }

    catDiv.appendChild(ul);
    box.appendChild(catDiv);
  });

  renderLastUpdated();
}

function createItemEl(ci, ii, item) {
  const li = document.createElement('li');
  li.className = 'menu-item';
  li.setAttribute('role', 'button');
  li.setAttribute('tabindex', '0');

  const thumb = item.image
    ? '<img class="item-thumb" src="' + item.image + '" alt="' + escapeHtml(item.name) + '">'
    : '<span class="item-thumb placeholder">' + escapeHtml(item.name.charAt(0)) + '</span>';

  li.innerHTML =
    thumb +
    '<div class="item-info">' +
      '<span class="item-name">' + escapeHtml(item.name) + '</span>' +
      (item.description ? '<span class="item-desc">' + escapeHtml(item.description) + '</span>' : '') +
    '</div>' +
    '<span class="dots"></span>' +
    '<span class="item-price">&#8369;' + item.price + '</span>';

  const open = () => openItemModal(ci, ii);
  li.addEventListener('click', open);
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });
  return li;
}

function openItemModal(ci, ii) {
  const item = menu.categories[ci].items[ii];
  const img = document.getElementById('detailImage');
  if (item.image) {
    img.src = item.image;
    img.hidden = false;
  } else {
    img.removeAttribute('src');
    img.hidden = true;
  }
  document.getElementById('detailName').textContent = item.name;
  document.getElementById('detailPrice').textContent = '&#8369;' + item.price;
  document.getElementById('detailDesc').textContent = item.description || 'No description added yet.';
  document.getElementById('itemModal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeItemModal() {
  document.getElementById('itemModal').hidden = true;
  document.body.style.overflow = '';
}

function renderLastUpdated() {
  const el = document.getElementById('lastUpdated');
  if (!el) return;
  if (menu.lastUpdated) {
    const d = new Date(menu.lastUpdated);
    const isToday = d.toDateString() === new Date().toDateString();
    el.textContent = isToday ? 'Updated today' : 'Last updated ' + d.toLocaleDateString();
  } else {
    el.textContent = "Today's menu";
  }
}

// ---------- admin panel ----------

function openAdmin() {
  if (!isLoggedIn()) {
    openLoginModal();
    return;
  }
  populateCategorySelect();
  renderAdminList();
  resetForm();
  document.getElementById('adminPanel').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeAdmin() {
  document.getElementById('adminPanel').hidden = true;
  document.body.style.overflow = '';
}

function openLoginModal() {
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').hidden = true;
  document.getElementById('loginModal').hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('loginPass').focus(), 50);
}

function closeLoginModal() {
  document.getElementById('loginModal').hidden = true;
  document.body.style.overflow = '';
}

async function handleLogin(e) {
  e.preventDefault();
  const input = document.getElementById('loginPass');
  const val = input.value;
  const expected = await ensurePassHash();
  const actual = await hashPassword(val);
  if (actual === expected) {
    sessionStorage.setItem(SESSION_KEY, '1');
    input.value = '';
    document.getElementById('loginError').hidden = true;
    closeLoginModal();
    openAdmin();
  } else {
    input.value = '';
    document.getElementById('loginError').hidden = false;
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  resetForm();
  closeAdmin();
}

async function changePassword() {
  const msg = document.getElementById('passMsg');
  const cur = document.getElementById('curPass').value;
  const next = document.getElementById('newPass').value;
  const conf = document.getElementById('confirmPass').value;

  msg.classList.remove('ok');
  msg.classList.add('error');

  if (!cur || !next || !conf) {
    msg.textContent = 'Please fill in all password fields.';
    return;
  }
  if (next.length < 4) {
    msg.textContent = 'New password must be at least 4 characters.';
    return;
  }
  if (next !== conf) {
    msg.textContent = 'New passwords do not match.';
    return;
  }

  const expected = await ensurePassHash();
  const actual = await hashPassword(cur);
  if (actual !== expected) {
    msg.textContent = 'Current password is incorrect.';
    return;
  }

  const h = await hashPassword(next);
  localStorage.setItem(ADMIN_PASS_KEY, h);
  msg.classList.remove('error');
  msg.classList.add('ok');
  msg.textContent = 'Password updated.';
  document.getElementById('curPass').value = '';
  document.getElementById('newPass').value = '';
  document.getElementById('confirmPass').value = '';
}

function populateCategorySelect() {
  const select = document.getElementById('categorySelect');
  select.innerHTML = '';
  menu.categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat.category;
    opt.textContent = cat.category;
    select.appendChild(opt);
  });
}

function renderAdminList() {
  const list = document.getElementById('adminItemList');
  list.innerHTML = '';
  if (!menu.categories.length) {
    list.innerHTML = '<p class="admin-empty">No categories yet. Add one below.</p>';
    return;
  }
  menu.categories.forEach((cat, ci) => {
    const h4 = document.createElement('h4');
    h4.textContent = cat.category;
    list.appendChild(h4);

    if (!cat.items.length) {
      const p = document.createElement('p');
      p.className = 'admin-empty';
      p.textContent = 'No items in this category.';
      list.appendChild(p);
    }
    cat.items.forEach((item, ii) => list.appendChild(createAdminRow(ci, ii, item)));
  });
}

function createAdminRow(ci, ii, item) {
  const row = document.createElement('div');
  row.className = 'admin-row';
  row.innerHTML =
    (item.image
      ? '<img src="' + item.image + '" alt="' + escapeHtml(item.name) + '">'
      : '<span class="admin-thumb placeholder">' + escapeHtml(item.name.charAt(0)) + '</span>') +
    '<div class="admin-info">' +
      '<div class="admin-name">' + escapeHtml(item.name) + '</div>' +
      '<div class="admin-meta">&#8369;' + item.price + '</div>' +
    '</div>' +
    '<button type="button" class="mini-btn" data-action="edit" data-ci="' + ci + '" data-ii="' + ii + '">Edit</button>' +
    '<button type="button" class="mini-btn danger" data-action="delete" data-ci="' + ci + '" data-ii="' + ii + '">Delete</button>';
  return row;
}

function editItem(ci, ii) {
  const item = menu.categories[ci].items[ii];
  editingRef = { ci, ii };
  pendingImage = item.image || '';
  document.getElementById('categorySelect').value = menu.categories[ci].category;
  document.getElementById('itemName').value = item.name;
  document.getElementById('itemPrice').value = item.price;
  document.getElementById('itemDesc').value = item.description || '';
  document.getElementById('imageInput').value = '';
  setPreview(pendingImage);
  document.getElementById('formTitle').textContent = 'Edit: ' + item.name;
  document.getElementById('saveItemBtn').textContent = 'Update Item';
  document.getElementById('itemForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteItem(ci, ii) {
  const cat = menu.categories[ci];
  const item = cat.items[ii];
  if (!window.confirm('Delete "' + item.name + '" from ' + cat.category + '?')) return;
  cat.items.splice(ii, 1);
  if (editingRef && editingRef.ci === ci) resetForm();
  saveMenu();
  renderMenu();
  renderAdminList();
}

function handleItemSubmit(e) {
  e.preventDefault();
  const catName = document.getElementById('categorySelect').value;
  const name = document.getElementById('itemName').value.trim();
  const price = parseFloat(document.getElementById('itemPrice').value);
  const desc = document.getElementById('itemDesc').value.trim();
  if (!catName || !name || isNaN(price)) return;

  const cat = menu.categories.find((c) => c.category === catName);
  const item = { name, description: desc, price, image: pendingImage || '' };

  if (editingRef) {
    cat.items[editingRef.ii] = item;
  } else {
    cat.items.push(item);
  }
  resetForm();
  saveMenu();
  renderMenu();
  renderAdminList();
}

function addCategory() {
  const name = window.prompt('New category name (e.g. EXTRA):');
  if (!name) return;
  const trimmed = name.trim().toUpperCase();
  if (!trimmed) return;
  if (menu.categories.some((c) => c.category.toUpperCase() === trimmed)) {
    alert('That category already exists.');
    return;
  }
  menu.categories.push({ category: trimmed, items: [] });
  saveMenu();
  populateCategorySelect();
  renderMenu();
  renderAdminList();
}

function resetMenuToDefault() {
  if (!window.confirm('Reset the menu back to the default items? This cannot be undone.')) return;
  localStorage.removeItem(STORAGE_KEY);
  menu = loadMenu();
  resetForm();
  populateCategorySelect();
  renderMenu();
  renderAdminList();
}

function resetForm() {
  editingRef = null;
  pendingImage = '';
  document.getElementById('itemForm').reset();
  setPreview('');
  document.getElementById('formTitle').textContent = 'Add New Item';
  document.getElementById('saveItemBtn').textContent = 'Add Item';
}

function setPreview(src) {
  const preview = document.getElementById('imagePreview');
  const removeBtn = document.getElementById('removeImageBtn');
  if (src) {
    preview.src = src;
    preview.hidden = false;
    removeBtn.hidden = false;
  } else {
    preview.removeAttribute('src');
    preview.hidden = true;
    removeBtn.hidden = true;
  }
}

// ---------- events ----------

function bindEvents() {
  document.getElementById('editMenuBtn').addEventListener('click', openAdmin);
  document.getElementById('closeAdminBtn').addEventListener('click', closeAdmin);
  document.getElementById('adminPanel').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAdmin();
  });

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('closeLoginBtn').addEventListener('click', closeLoginModal);
  document.getElementById('cancelLoginBtn').addEventListener('click', closeLoginModal);
  document.getElementById('loginModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeLoginModal();
  });

  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('changePassBtn').addEventListener('click', changePassword);

  document.getElementById('closeItemModal').addEventListener('click', closeItemModal);
  document.getElementById('itemModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeItemModal();
  });

  document.getElementById('itemForm').addEventListener('submit', handleItemSubmit);
  document.getElementById('cancelEditBtn').addEventListener('click', resetForm);

  document.getElementById('imageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      alert('That image is too large (max 6 MB). Please pick a smaller one.');
      e.target.value = '';
      return;
    }
    fileToDataURL(file)
      .then((dataUrl) => {
        pendingImage = dataUrl;
        setPreview(dataUrl);
      })
      .catch(() => {
        alert('Could not read that image file. Try another one.');
        e.target.value = '';
      });
  });

  document.getElementById('removeImageBtn').addEventListener('click', () => {
    pendingImage = '';
    document.getElementById('imageInput').value = '';
    setPreview('');
  });

  document.getElementById('adminItemList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const ci = Number(btn.dataset.ci);
    const ii = Number(btn.dataset.ii);
    if (btn.dataset.action === 'edit') editItem(ci, ii);
    if (btn.dataset.action === 'delete') deleteItem(ci, ii);
  });

  document.getElementById('addCategoryBtn').addEventListener('click', addCategory);
  document.getElementById('resetMenuBtn').addEventListener('click', resetMenuToDefault);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAdmin();
      closeItemModal();
      closeLoginModal();
    }
  });
}

function bindNav() {
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section');

  window.addEventListener('scroll', () => {
    let current = '';
    const scrollPosition = window.scrollY + 120;

    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPosition >= top && scrollPosition < top + height) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
  });
}
