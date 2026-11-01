function applySavedBusinessSettings() {
    try {
        const settings = JSON.parse(localStorage.getItem("roastAdmin_settings") || "null");
        if (!settings) return;

        const address = (settings.address || "").trim();
        const addressLine = document.querySelector("#footerAddress");
        const addressText = document.querySelector("#footerAddressText");
        if (addressLine && addressText && address) {
            addressText.textContent = address;
            addressLine.classList.remove("d-none");
        } else if (addressLine) {
            addressLine.classList.add("d-none");
        }

        const description = document.querySelector("#footerDescription");
        if (description && settings.description) description.textContent = settings.description;

        const phone = (settings.phone || "").trim();
        const phoneLink = document.querySelector("#footerPhone");
        if (phoneLink) {
            if (phone) {
                phoneLink.href = "tel:" + phone.replace(/[^+\\d]/g, "");
                phoneLink.querySelector("span").textContent = phone;
                phoneLink.classList.remove("d-none");
            } else {
                phoneLink.classList.add("d-none");
            }
        }

        const email = (settings.email || "").trim();
        const emailLink = document.querySelector("#footerEmail");
        if (emailLink) {
            if (email) {
                emailLink.href = "mailto:" + email;
                emailLink.querySelector("span").textContent = email;
                emailLink.classList.remove("d-none");
            } else {
                emailLink.classList.add("d-none");
            }
        }

        const instagram = document.querySelector("#footerInstagram");
        if (instagram) {
            if (settings.instagram) instagram.href = settings.instagram;
            else instagram.classList.add("d-none");
        }
        const whatsapp = document.querySelector("#footerWhatsapp");
        if (whatsapp) {
            if (settings.whatsapp) whatsapp.href = settings.whatsapp;
            else whatsapp.classList.add("d-none");
        }
    } catch (error) {
        console.warn("İşletme ayarları okunamadı.", error);
    }
}

function applyMenuAppearance(appearance) {
    if (!appearance) return;

    const logo = document.querySelector(".brand-logo img");
    if (logo) {
        logo.parentElement.style.display = appearance.logo ? "block" : "none";
        if (appearance.logo) logo.src = appearance.logo;
    }

    const brandName = document.querySelector(".brand-name");
    if (brandName && appearance.brandName) brandName.textContent = appearance.brandName;

    const subtitle = document.querySelector(".brand-subtitle");
    if (subtitle && appearance.tagline) subtitle.textContent = appearance.tagline;

    const status = document.querySelector(".open-status");
    if (status) {
        const isOpen = appearance.isOpen !== false;
        status.classList.toggle("is-closed", !isOpen);
        status.setAttribute("aria-label", isOpen ? "İşletme açık" : "İşletme kapalı");
        status.textContent = "";
        const dot = document.createElement("span");
        dot.className = "status-dot";
        status.append(dot, document.createTextNode(isOpen ? "Açığız" : "Kapalıyız"));
    }

    const heroImage = document.querySelector(".hero-image");
    if (heroImage) {
        heroImage.style.display = appearance.cover ? "block" : "none";
        if (appearance.cover) heroImage.src = appearance.cover;
    }

    const heroLabel = document.querySelector(".hero-label");
    if (heroLabel && appearance.eyebrow) {
        heroLabel.textContent = "";
        const icon = document.createElement("i");
        icon.className = "bi bi-stars me-1";
        heroLabel.append(icon, document.createTextNode(appearance.eyebrow));
    }

    const heroHeading = document.querySelector(".hero-content h1");
    if (heroHeading && appearance.headline) {
        heroHeading.textContent = "";
        appearance.headline.split("\n").forEach((line, index) => {
            if (index) heroHeading.append(document.createElement("br"));
            heroHeading.append(document.createTextNode(line));
        });
    }

    const reviewLink = document.getElementById("googleReviewLink");
    const googleReviewUrl = (appearance.googleReviewUrl || "").trim();
    if (reviewLink) {
        try {
            const parsedReviewUrl = new URL(googleReviewUrl);
            if (["http:", "https:"].includes(parsedReviewUrl.protocol)) {
                reviewLink.href = parsedReviewUrl.href;
                reviewLink.removeAttribute("aria-disabled");
                reviewLink.removeAttribute("tabindex");
            } else {
                reviewLink.removeAttribute("href");
                reviewLink.setAttribute("aria-disabled", "true");
                reviewLink.setAttribute("tabindex", "-1");
            }
        } catch (error) {
            reviewLink.removeAttribute("href");
            reviewLink.setAttribute("aria-disabled", "true");
            reviewLink.setAttribute("tabindex", "-1");
        }
    }

    if (appearance.accent) document.documentElement.style.setProperty("--menu-accent", appearance.accent);
    const footerBrand = document.querySelector(".footer-brand");
    if (footerBrand && appearance.brandName) {
        footerBrand.textContent = "";
        const icon = document.createElement("i");
        icon.className = "bi bi-cup-hot-fill me-1";
        footerBrand.append(icon, document.createTextNode(appearance.brandName));
    }
}

async function loadMenuAppearance() {
    try {
        const response = await fetch("/api/appearance", { headers: { "Accept": "application/json" } });
        if (!response.ok) throw new Error("Menü görünümü şu anda yüklenemiyor.");
        const result = await response.json();
        applyMenuAppearance(result.appearance);
    } catch (error) {
        console.error("Menü görünümü yüklenemedi.", error);
    }
}

let products = [];
let categories = [];

const productList = document.querySelector("#productList");
const categoryList = document.querySelector("#categoryList");
const categoryScrollHint = document.querySelector("#categoryScrollHint");
const categoryScrollProgress = document.querySelector("#categoryScrollProgress");
const searchInput = document.querySelector("#searchInput");
const clearSearch = document.querySelector("#clearSearch");
const menuCount = document.querySelector("#menuCount");
const productsHeading = document.querySelector("#productsHeading");
const emptyState = document.querySelector("#emptyState");
const resetFilters = document.querySelector("#resetFilters");

let selectedCategory = "all";
let searchTerm = "";
let scrollRevealObserver = null;

function observeScrollReveals() {
    const targets = document.querySelectorAll(".scroll-reveal:not(.is-visible)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion || !("IntersectionObserver" in window)) {
        targets.forEach((target) => target.classList.add("is-visible"));
        return;
    }

    if (scrollRevealObserver) scrollRevealObserver.disconnect();

    scrollRevealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        });
    }, {
        threshold: 0.08,
        rootMargin: "0px 0px -32px 0px"
    });

    targets.forEach((target) => scrollRevealObserver.observe(target));
}

function initializePageAnimations() {
    const animatedSections = [
        ".menu-container > header",
        ".hero-section",
        "#reviewCtaSection",
        ".menu-heading",
        ".search-box",
        "#categoryList",
        "#categoryScrollHint",
        ".products-section",
        ".menu-footer"
    ];

    animatedSections.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => {
            element.classList.add("scroll-reveal");
        });
    });

    document.body.classList.add("motion-ready");
    observeScrollReveals();
}

const formatPrice = (price) =>
    new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 2
    }).format(price);

function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function safeProductImage(value) {
    const image = String(value || "");
    if (/^\/uploads\/products\/[a-f0-9-]{36}\.(?:webp|png|jpg)$/i.test(image)) return image;
    if (/^https:\/\/[a-z0-9.-]+\//i.test(image)) return image;
    return "";
}

function renderCategories() {
    if (!categories.some((category) => category.id === selectedCategory)) {
        selectedCategory = "all";
    }

    categoryList.innerHTML = [
        '<button type="button" class="category-btn ' + (selectedCategory === "all" ? "active" : "") + '" data-category="all" aria-pressed="' + (selectedCategory === "all") + '">Tümü</button>',
        ...categories.map((category) => {
            const active = selectedCategory === category.id;
            const icon = category.icon ? '<i class="bi ' + escapeHtml(category.icon) + ' me-1" aria-hidden="true"></i>' : "";
            return '<button type="button" class="category-btn ' + (active ? "active" : "") + '" data-category="' + escapeHtml(category.id) + '" aria-pressed="' + active + '">' + icon + escapeHtml(category.name) + '</button>';
        })
    ].join("");

    updateCategoryScrollHint();
}

function renderProducts() {
    const filteredProducts = products.filter((product) => {
        const matchesCategory =
            selectedCategory === "all" || product.categoryId === selectedCategory;

        const searchableText =
            `${product.name} ${product.description} ${product.categoryName}`.toLocaleLowerCase("tr-TR");

        return matchesCategory && searchableText.includes(searchTerm);
    });

    productList.innerHTML = filteredProducts.map((product, index) => {
        const image = safeProductImage(product.image);
        const imageMarkup = image
            ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.name) + '" class="product-image" loading="lazy">'
            : '<div class="product-image product-image-placeholder d-flex align-items-center justify-content-center" aria-hidden="true"><i class="bi bi-cup-hot"></i></div>';

        return `
            <div class="col-6 scroll-reveal" style="--reveal-delay: ${Math.min(index % 4, 3) * 45}ms">
                <article class="product-card">
                    ${imageMarkup}
                    <div class="product-body">
                        <div class="d-flex align-items-center justify-content-between gap-2">
                            <span class="product-category">${escapeHtml(product.categoryName)}</span>
                            ${product.isOutOfStock ? '<span class="product-sold-out">Tükendi</span>' : ""}
                        </div>
                        <h4 class="product-name">${escapeHtml(product.name)}</h4>
                        <p class="product-description">${escapeHtml(product.description || "")}</p>
                        <span class="product-price">${formatPrice(Number(product.price))}</span>
                    </div>
                </article>
            </div>
        `;
    }).join("");

    menuCount.textContent = `${filteredProducts.length} ürün`;
    emptyState.classList.toggle("d-none", filteredProducts.length !== 0);
    productList.classList.toggle("d-none", filteredProducts.length === 0);
    clearSearch.classList.toggle("d-none", searchTerm.length === 0);

    const emptyTitle = emptyState.querySelector("h4");
    const emptyDescription = emptyState.querySelector("p");
    if (emptyTitle && emptyDescription) {
        if (products.length === 0) {
            emptyTitle.textContent = "Henüz menüye ürün eklenmemiş";
            emptyDescription.textContent = "İşletme menüsünü güncellediğinde ürünler burada görünecek.";
        } else {
            emptyTitle.textContent = "Aradığını bulamadık";
            emptyDescription.textContent = "Farklı bir ürün veya kategori deneyebilirsin.";
        }
    }

    const activeCategoryButton = categoryList.querySelector(".category-btn.active");
    productsHeading.textContent = searchTerm
        ? "Arama sonuçları"
        : activeCategoryButton?.textContent.trim() === "Tümü"
            ? "Tüm lezzetler"
            : activeCategoryButton?.textContent.trim() || "Tüm lezzetler";

    if (document.body.classList.contains("motion-ready")) {
        observeScrollReveals();
    }
}

categoryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    selectedCategory = button.dataset.category;
    renderCategories();
    renderProducts();
});

searchInput.addEventListener("input", () => {
    searchTerm = searchInput.value.trim().toLocaleLowerCase("tr-TR");
    renderProducts();
});

clearSearch.addEventListener("click", () => {
    searchInput.value = "";
    searchTerm = "";
    searchInput.focus();
    renderProducts();
});

resetFilters.addEventListener("click", () => {
    selectedCategory = "all";
    searchTerm = "";
    searchInput.value = "";

    categoryList.querySelectorAll(".category-btn").forEach((button) => {
        const isActive = button.dataset.category === "all";
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });

    renderProducts();
});

function updateCategoryScrollHint() {
    const maxScroll = categoryList.scrollWidth - categoryList.clientWidth;
    const hasOverflow = maxScroll > 4;

    categoryScrollHint.classList.toggle("d-none", !hasOverflow);

    if (!hasOverflow) return;

    const progress = categoryList.scrollLeft / maxScroll;
    categoryScrollProgress.style.width = `${progress * 100}%`;
}

categoryList.addEventListener("scroll", updateCategoryScrollHint, { passive: true });
window.addEventListener("resize", updateCategoryScrollHint);

loadMenuAppearance();
applySavedBusinessSettings();
renderCategories();
renderProducts();
initializePageAnimations();

async function loadMenuCatalog() {
    try {
        const response = await fetch("/api/menu", { headers: { "Accept": "application/json" } });
        if (!response.ok) throw new Error("Menü verileri şu anda yüklenemiyor.");

        const result = await response.json();
        categories = Array.isArray(result.categories) ? result.categories : [];
        products = Array.isArray(result.products) ? result.products : [];

        renderCategories();
        renderProducts();
        updateCategoryScrollHint();
    } catch (error) {
        console.error("Menü kataloğu yüklenemedi.", error);
        const emptyTitle = emptyState.querySelector("h4");
        const emptyDescription = emptyState.querySelector("p");
        if (emptyTitle) emptyTitle.textContent = "Menü şu anda yüklenemiyor";
        if (emptyDescription) emptyDescription.textContent = "Lütfen birkaç dakika sonra tekrar deneyin.";
        emptyState.classList.remove("d-none");
        productList.classList.add("d-none");
    }
}

loadMenuCatalog();
