const iframe = document.getElementById("content-iframe");
const menuItems = document.querySelectorAll(".menu-item");

function loadPage(pageName) {
    const loading = document.querySelector(".loading");
    loading.style.display = "block";

    // Remove active class from all items
    menuItems.forEach((item) => item.classList.remove("active"));

    // Add active class to clicked item
    const activeItem = document.querySelector(`[data-page="${pageName}"]`);
    if (activeItem) {
        activeItem.classList.add("active");
    }

    // Load the page
    iframe.src = pageName;

    iframe.onload = () => {
        loading.style.display = "none";
    };
}

menuItems.forEach((item) => {
    item.addEventListener("click", () => {
        const page = item.getAttribute("data-page");
        loadPage(page);
    });
});

// Load home page by default
loadPage("./pages/home.html");