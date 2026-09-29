(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

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

  // ---------- Catalogue ----------
  function renderProducts(filter = "all") {
    $("#productGrid").innerHTML = PRODUCTS.filter((p) => filter === "all" || p.category === filter)
      .map((p) => `
        <article class="product">
          <div class="product-media">
            <img src="${p.image}" alt="${p.alt}" loading="lazy">
            <span class="product-code mono">${p.code}</span>
            <button class="quick-add" data-add="${p.id}">Add to order</button>
          </div>
          <div class="product-info">
            <div class="product-title">
              <h3>${p.name}</h3>
              <span class="price">${money(p.price)}</span>
            </div>
            <span class="mono free-note">Free delivery</span>
            <p>${p.blurb}</p>
            <ul class="specs">${p.features.map((f, i) => `<li><span class="mono">0${i + 1}</span>${f}</li>`).join("")}</ul>
            <button class="btn btn-ink btn-block add-mobile" data-add="${p.id}">Add to order</button>
          </div>
        </article>`)
      .join("");
  }

  function setFilter(filter) {
    $$(".tab").forEach((t) => {
      const on = t.dataset.filter === filter;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on);
    });
    renderProducts(filter);
  }

  // ---------- Setups ----------
  function renderSetups() {
    $("#setupGrid").innerHTML = SETUPS.map((s, i) => `
      <article class="setup">
        <div class="setup-media"><img src="${s.image}" alt="${s.alt}" loading="lazy"></div>
        <div class="setup-body">
          <span class="mono">Setup 0${i + 1}</span>
          <h3>${s.name}</h3>
          <p>${s.blurb}</p>
          <ul class="equation">
            ${s.items.map((id) => `<li><span>${byId[id].name}</span><span>${money(byId[id].price)}</span></li>`).join("")}
            <li><span>Delivery</span><span class="free">Free</span></li>
            <li class="total"><span>Together</span><span>${money(setupPrice(s))}</span></li>
          </ul>
          <button class="btn btn-signal" data-setup="${s.id}">Add the setup <span aria-hidden="true">→</span></button>
        </div>
      </article>`).join("");
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
    $("#cartCount").textContent = cart.reduce((n, l) => n + l.qty, 0);
    $("#cartEmpty").hidden = cart.length > 0;
    $("#orderForm").hidden = cart.length === 0;
    $("#sendOrder").disabled = cart.length === 0;
    $("#cartTotal").textContent = money(cartTotal());
    $("#sendOrder").textContent = STORE.whatsapp ? "Send order on WhatsApp" : "Send order by email";
    $("#cartList").innerHTML = cart.map((l) => {
      const p = byId[l.id];
      return `
        <li class="line">
          <img src="${p.image}" alt="">
          <div>
            <span class="mono">${p.code}</span>
            <h4>${p.name}</h4>
            <div class="line-price">${money(p.price * l.qty)}</div>
          </div>
          <div class="stepper" aria-label="Quantity for ${p.name}">
            <button data-qty="${l.id}" data-delta="-1" aria-label="Remove one">−</button>
            <span>${l.qty}</span>
            <button data-qty="${l.id}" data-delta="1" aria-label="Add one">+</button>
          </div>
        </li>`;
    }).join("");
  }

  // ---------- Sending the order ----------
  function buildMessage(form) {
    const lines = cart.map((l) => `- ${l.qty} x ${byId[l.id].name} [${byId[l.id].code}] (${money(byId[l.id].price * l.qty)})`);
    const note = form.note.value.trim();
    return [
      `Hello ${STORE.name}, I'd like to order:`,
      "",
      ...lines,
      "",
      `Total: ${money(cartTotal())} (free delivery)`,
      "",
      `Name: ${form.name.value.trim()}`,
      `Phone: ${form.phone.value.trim()}`,
      `Delivery address: ${form.address.value.trim()}`,
      note ? `Note: ${note}` : null,
      "",
      "Please confirm the delivery date. I'll pay on delivery.",
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

  function renderStatic() {
    const links = [];
    if (STORE.whatsapp) links.push(`<li><a href="https://wa.me/${STORE.whatsapp}" target="_blank" rel="noopener">WhatsApp</a></li>`);
    links.push(`<li><a href="mailto:${STORE.email}">${STORE.email}</a></li>`);
    links.push(`<li><a href="https://instagram.com/${STORE.instagram}" target="_blank" rel="noopener">Instagram</a></li>`);
    links.push(`<li><a href="https://tiktok.com/@${STORE.tiktok}" target="_blank" rel="noopener">TikTok</a></li>`);
    $("#contactLinks").innerHTML = links.join("");

    const hello = contactUrl("Hi TekRest, I have a question about your chairs and desks.", "Question for TekRest");
    ["#heroChat", "#ctaChat", "#waFloat"].forEach((sel) => {
      const a = $(sel);
      a.href = hello;
      a.target = "_blank";
      a.rel = "noopener";
    });
    const notify = $("#notifyBtn");
    notify.href = contactUrl("Hi TekRest, please let me know when massage chairs are available.", "Massage chairs");
    notify.target = "_blank";
    notify.rel = "noopener";

    const heroProduct = byId["ergo-chair-white"];
    if (heroProduct) $("#heroPrice").textContent = money(heroProduct.price);
    $("#factCount").textContent = PRODUCTS.length;
    $("#year").textContent = new Date().getFullYear();
  }

  // Play videos only while they're on screen.
  function setupVideos() {
    const vids = $$(".reel video");
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
      const label = add.textContent;
      addToCart(add.dataset.add);
      add.textContent = "Added ✓";
      add.classList.add("added");
      setTimeout(() => { add.textContent = label; add.classList.remove("added"); }, 1400);
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
    const tab = e.target.closest(".tab");
    if (tab) { setFilter(tab.dataset.filter); return; }
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
  renderStatic();
  setupVideos();
})();
