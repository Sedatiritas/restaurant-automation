document.addEventListener("DOMContentLoaded", () => {
    const toastElement = document.querySelector("#adminToast");
    const toastMessage = document.querySelector("#adminToastMessage");
    const toast = toastElement && window.bootstrap
        ? bootstrap.Toast.getOrCreateInstance(toastElement, { delay: 2800 })
        : null;

    function showNotice(message) {
        if (!toast || !toastMessage) {
            window.alert(message);
            return;
        }

        toastMessage.textContent = message;
        toast.show();
    }

    const sectionNames = {
        overview: "Genel Bakış",
        products: "Ürünler",
        categories: "Kategoriler",
        appearance: "Menü Görünümü",
        qr: "QR Menü",
        staff: "Personel ve Yetkiler",
        settings: "İşletme Ayarları"
    };

    document.querySelectorAll("[data-view]").forEach((link) => {
        link.addEventListener("click", (event) => {
            const view = link.dataset.view;

            if (!view || view === "overview") {
                event.preventDefault();
                return;
            }

            event.preventDefault();
            showNotice(`${sectionNames[view] || "Bu bölüm"} ekranını sonraki aşamada birlikte oluşturacağız.`);

            const sidebar = document.querySelector("#adminSidebar");
            if (sidebar && window.bootstrap && sidebar.classList.contains("show")) {
                bootstrap.Offcanvas.getOrCreateInstance(sidebar).hide();
            }
        });
    });

    document.querySelectorAll(".table-more").forEach((button) => {
        button.addEventListener("click", () => {
            const productName = button.closest("tr")?.querySelector(".table-product strong")?.textContent;
            showNotice(`${productName || "Ürün"} için düzenleme işlemlerini ürün yönetimi ekranında ekleyeceğiz.`);
        });
    });

    document.querySelector(".notification-button")?.addEventListener("click", () => {
        showNotice("Şimdilik yeni bildiriminiz yok.");
    });

    document.querySelector(".profile-button")?.addEventListener("click", () => {
        showNotice("Hesap ve oturum işlemleri giriş sistemi geliştirilirken eklenecek.");
    });
});
