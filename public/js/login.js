(() => {
  const page = document.querySelector(".login-page");
  const roleButtons = Array.from(document.querySelectorAll("[data-role-select]"));
  const form = document.getElementById("loginForm");
  const roleInput = document.getElementById("selectedRole");
  const roleName = document.getElementById("selectedRoleName");
  const changeRoleButton = document.getElementById("changeRoleButton");
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const togglePassword = document.getElementById("togglePassword");

  if (!page || !form || !roleInput || !roleName) return;

  const roleLabels = {
    ADMIN: "Yönetici",
    CASHIER: "Kasiyer",
    WAITER: "Garson"
  };

  function selectRole(role, focusUsername = true) {
    if (!roleLabels[role]) return;

    roleInput.value = role;
    roleName.textContent = roleLabels[role];
    form.hidden = false;

    roleButtons.forEach((button) => {
      const selected = button.dataset.roleSelect === role;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    if (focusUsername) {
      usernameInput?.focus();
    }
  }

  roleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectRole(button.dataset.roleSelect);
    });
  });

  changeRoleButton?.addEventListener("click", () => {
    form.hidden = true;
    roleInput.value = "";
    roleButtons.forEach((button) => {
      button.classList.remove("is-selected");
      button.setAttribute("aria-pressed", "false");
    });
    roleButtons[0]?.focus();
  });

  togglePassword?.addEventListener("click", () => {
    if (!passwordInput) return;

    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePassword.innerHTML = isPassword
      ? '<i class="bi bi-eye-slash"></i>'
      : '<i class="bi bi-eye"></i>';
    togglePassword.setAttribute(
      "aria-label",
      isPassword ? "Parolayı gizle" : "Parolayı göster"
    );
  });

  const initialRole = page.dataset.selectedRole;
  if (initialRole && roleLabels[initialRole]) {
    selectRole(initialRole, false);
    passwordInput?.focus();
  }
})();
