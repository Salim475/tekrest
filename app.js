(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const CATEGORY_LABEL = { gaming: "Gaming", office: "Office chair", desks: "Desk" };

  const money = (n) => STORE.currency + Number(n).toLocaleString("en-NG");
  const setupPrice = (s) => s.price ?? s.items.reduce((sum, id) => sum + byId[id].price, 0);

  // ---------- Cart state ----------
  const CART_KEY = "tekrest-cart";
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { cart = []; }
  cart = cart.filter((line) => byId[line.id]);

  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* storage unavailable */ }
  }

  function addToCart(id, qty = 1) {
    const line = cart.find((l) => l.id === id);
    if (line) line.qty += qty; else cart.push({ id, qty });
    saveCart();
    renderCart();
  }

  function setQty(id, qty) {
    cart = qty <= 0 ? cart.filter((l) => l.id !== id) : cart.map((l) => (l.id === id ? { ...l, qty } : l));
    saveCart();
    renderCart();
  }

  const cartTotal = () => cart.reduce((sum, l) => sum + byId[l.id].price * l.qty, 0);

  // ---------- Products ----------
  function renderProducts(filter = "all") {
    const grid = $("#productGrid");
    grid.innerHTML = PRODUCTS.filter((p) => filter === "all" || p.category === filter)
      .map((p) => `
        <article class="card">
          <div class="card-img">
            <img src="${p.image}" alt="${p.alt}" loading="lazy">
            <span class="card-cat">${CATEGORY_LABEL[p.category]}</span>
          </div>
          <div class="card-body">
            <h3>${p.name}</h3>
            <p>${p.blurb}</p>
            <ul class="features">${p.features.map((f) => `<li>${f}</li>`).join("")}</ul>
            <div class="card-foot">
              <span class="price">${money(p.price)}</span>
              <button class="add-btn" data-add="${p.id}">Add to order</button>
            </div>
          </div>
        </article>`)
      .join("");
  }

  function setFilter(filter) {
    $$(".chip").forEach((c) => {
      const on = c.dataset.filter === filter;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-selected", on);
    });
    renderProducts(filter);
  }

  // ---------- Setups ----------
  function renderSetups() {
    $("#setupGrid").innerHTML = SETUPS.map((s) => `
      <article class="setup">
        <img src="${s.image}" alt="${s.alt}" loading="lazy">
        <div class="setup-body">
          <h3>${s.name}</h3>
          <p>${s.blurb}</p>
          <ul class="setup-items">
            ${s.items.map((id) => `<li><span>${byId[id].name}</span><span>${money(byId[id].price)}</span></li>`).join("")}
          </ul>
          <div class="setup-foot">
            <span class="price">${money(setupPrice(s))}</span>
            <button class="btn btn-primary" data-setup="${s.id}">Add both to order</button>
          </div>
        </div>
      </article>`).join("");

    const gaming = SETUPS.find((s) => s.id === "setup-gaming");
    if (gaming) $("#heroPrice").textContent = money(setupPrice(gaming));
  }

  // ---------- Drawer ----------
  const drawer = $("#drawer");
  const backdrop = $("#backdrop");

  function openDrawer() {
    backdrop.hidden = false;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    $("#cartClose").focus();
  }
  function closeDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    document.body.style.overflow = "";
  }

  function renderCart() {
    const count = cart.reduce((n, l) => n + l.qty, 0);
    $("#cartCount").textContent = count;
    $("#cartEmpty").hidden = cart.length > 0;
    $("#orderForm").hidden = cart.length === 0;
    $("#sendOrder").disabled = cart.length === 0;
    $("#cartTotal").textContent = money(cartTotal());
    $("#sendOrder").textContent = STORE.whatsapp ? "Send order on WhatsApp" : "Send order by email";
    $("#cartList").innerHTML = cart.map((l) => {
      const p = byId[l.id];
      return `
        <li class="cart-item">
          <img src="${p.image}" alt="">
          <div>
            <h4>${p.name}</h4>
            <span class="muted">${money(p.price)}</span>
          </div>
          <div class="qty" aria-label="Quantity for ${p.name}">
            <button data-qty="${l.id}" data-delta="-1" aria-label="Remove one">−</button>
            <span>${l.qty}</span>
            <button data-qty="${l.id}" data-delta="1" aria-label="Add one">+</button>
          </div>
        </li>`;
    }).join("");
  }

  // ---------- Sending the order ----------
  function buildMessage(form) {
    const lines = cart.map((l) => `- ${l.qty} x ${byId[l.id].name} (${money(byId[l.id].price * l.qty)})`);
    const note = form.note.value.trim();
    return [
      `Hello ${STORE.name}, I'd like to order:`,
      "",
      ...lines,
      "",
      `Subtotal: ${money(cartTotal())}`,
      "",
      `Name: ${form.name.value.trim()}`,
      `Phone: ${form.phone.value.trim()}`,
      `Delivery address: ${form.address.value.trim()}`,
      note ? `Note: ${note}` : null,
      "",
      "Please confirm delivery cost and date. I'll pay on delivery.",
    ].filter((x) => x !== null).join("\n");
  }

  function contactUrl(text, subject) {
    if (STORE.whatsapp) return `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(text)}`;
    return `mailto:${STORE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  }

  function sendOrder() {
    const form = $("#orderForm");
    let ok = true;
    ["name", "phone", "address"].forEach((f) => {
      const empty = !form[f].value.trim();
      form[f].classList.toggle("invalid", empty);
      if (empty) ok = false;
    });
    if (!ok) { toast("Please add your name, phone number and delivery address."); return; }
    window.open(contactUrl(buildMessage(form), "New TekRest order"), "_blank", "noopener");
  }

  // ---------- Small helpers ----------
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function renderContact() {
    const links = [];
    if (STORE.whatsapp) links.push(`<li><a href="https://wa.me/${STORE.whatsapp}" target="_blank" rel="noopener">WhatsApp</a></li>`);
    links.push(`<li><a href="mailto:${STORE.email}">${STORE.email}</a></li>`);
    links.push(`<li><a href="https://instagram.com/${STORE.instagram}" target="_blank" rel="noopener">Instagram @${STORE.instagram}</a></li>`);
    links.push(`<li><a href="https://tiktok.com/@${STORE.tiktok}" target="_blank" rel="noopener">TikTok @${STORE.tiktok}</a></li>`);
    $("#contactLinks").innerHTML = links.join("");
    $("#notifyBtn").href = contactUrl("Hi TekRest, please let me know when massage chairs are available.", "Massage chairs");
    $("#year").textContent = new Date().getFullYear();
  }

  // Play videos only while they're on screen.
  function setupVideos() {
    const vids = $$(".videos video");
    if (!("IntersectionObserver" in window)) { vids.forEach((v) => v.setAttribute("controls", "")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause(); });
    }, { threshold: 0.4 });
    vids.forEach((v) => io.observe(v));
  }

  // ---------- Events ----------
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) {
      addToCart(add.dataset.add);
      add.textContent = "Added ✓";
      add.classList.add("added");
      setTimeout(() => { add.textContent = "Add to order"; add.classList.remove("added"); }, 1400);
      toast(`${byId[add.dataset.add].name} added to your order`);
      return;
    }
    const setup = e.target.closest("[data-setup]");
    if (setup) {
      const s = SETUPS.find((x) => x.id === setup.dataset.setup);
      s.items.forEach((id) => addToCart(id));
      toast(`${s.name} added to your order`);
      return;
    }
    const q = e.target.closest("[data-qty]");
    if (q) {
      const line = cart.find((l) => l.id === q.dataset.qty);
      setQty(q.dataset.qty, line.qty + Number(q.dataset.delta));
      return;
    }
    const chip = e.target.closest(".chip");
    if (chip) { setFilter(chip.dataset.filter); return; }
    const jump = e.target.closest("[data-jump]");
    if (jump) setFilter(jump.dataset.jump);
  });

  $("#cartOpen").addEventListener("click", openDrawer);
  $("#cartClose").addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("open")) closeDrawer(); });
  $("#sendOrder").addEventListener("click", sendOrder);
  $("#orderForm").addEventListener("input", (e) => e.target.classList.remove("invalid"));

  renderProducts();
  renderSetups();
  renderCart();
  renderContact();
  setupVideos();
})();
