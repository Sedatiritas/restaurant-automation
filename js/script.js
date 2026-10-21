const products = [
    {
        id: 1,
        name: "Cappuccino",
        category: "coffee",
        categoryName: "Kahveler",
        description: "Espresso, sıcak süt ve ipeksi süt köpüğü.",
        price: 125,
        image: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80"
    },
    {
        id: 2,
        name: "Flat White",
        category: "coffee",
        categoryName: "Kahveler",
        description: "Yoğun espresso ve ince dokulu süt.",
        price: 135,
        image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80"
    },
    {
        id: 3,
        name: "Americano",
        category: "coffee",
        categoryName: "Kahveler",
        description: "Sade, dengeli ve güçlü kahve lezzeti.",
        price: 110,
        image: "https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=600&q=80"
    },
    {
        id: 4,
        name: "Iced Latte",
        category: "cold",
        categoryName: "Soğuk içecekler",
        description: "Buz gibi süt ve espresso ile ferahlatıcı bir mola.",
        price: 140,
        image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80"
    },
    {
        id: 5,
        name: "Cold Brew",
        category: "cold",
        categoryName: "Soğuk içecekler",
        description: "Uzun süre soğuk demlenmiş yumuşak içimli kahve.",
        price: 130,
        image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80"
    },
    {
        id: 6,
        name: "Çilekli Cheesecake",
        category: "dessert",
        categoryName: "Tatlılar",
        description: "Kremamsı peynir dolgusu ve taze çilek dokunuşu.",
        price: 165,
        image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80"
    },
    {
        id: 7,
        name: "Brownie",
        category: "dessert",
        categoryName: "Tatlılar",
        description: "Yoğun çikolatalı, yumuşak dokulu brownie.",
        price: 145,
        image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80"
    },
    {
        id: 8,
        name: "San Sebastian",
        category: "dessert",
        categoryName: "Tatlılar",
        description: "Dışı karamelize, içi yumuşacık cheesecake.",
        price: 175,
        image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80"
    }
];

const productList = document.querySelector("#productList");
const categoryList = document.querySelector("#categoryList");
const searchInput = document.querySelector("#searchInput");
const clearSearch = document.querySelector("#clearSearch");
const menuCount = document.querySelector("#menuCount");
const productsHeading = document.querySelector("#productsHeading");
const emptyState = document.querySelector("#emptyState");
const resetFilters = document.querySelector("#resetFilters");

let selectedCategory = "all";
let searchTerm = "";

const formatPrice = (price) =>
    new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0
    }).format(price);

function renderProducts() {
    const filteredProducts = products.filter((product) => {
        const matchesCategory =
            selectedCategory === "all" || product.category === selectedCategory;

        const searchableText =
            `${product.name} ${product.description} ${product.categoryName}`.toLocaleLowerCase("tr-TR");

        const matchesSearch = searchableText.includes(searchTerm);

        return matchesCategory && matchesSearch;
    });

    productList.innerHTML = filteredProducts.map((product) => `
        <div class="col-6">
            <article class="product-card">
                <img
                    src="${product.image}"
                    alt="${product.name}"
                    class="product-image"
                    loading="lazy"
                >
                <div class="product-body">
                    <span class="product-category">${product.categoryName}</span>
                    <h4 class="product-name">${product.name}</h4>
                    <p class="product-description">${product.description}</p>
                    <span class="product-price">${formatPrice(product.price)}</span>
                </div>
            </article>
        </div>
    `).join("");

    menuCount.textContent = `${filteredProducts.length} ürün`;
    emptyState.classList.toggle("d-none", filteredProducts.length !== 0);
    productList.classList.toggle("d-none", filteredProducts.length === 0);
    clearSearch.classList.toggle("d-none", searchTerm.length === 0);

    const activeCategoryButton = categoryList.querySelector(".category-btn.active");
    productsHeading.textContent = searchTerm
        ? "Arama sonuçları"
        : activeCategoryButton?.textContent.trim() === "Tümü"
            ? "Tüm lezzetler"
            : activeCategoryButton?.textContent.trim() || "Tüm lezzetler";
}

categoryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");

    if (!button) return;

    selectedCategory = button.dataset.category;

    categoryList.querySelectorAll(".category-btn").forEach((categoryButton) => {
        const isActive = categoryButton === button;
        categoryButton.classList.toggle("active", isActive);
        categoryButton.setAttribute("aria-pressed", String(isActive));
    });

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

renderProducts();
