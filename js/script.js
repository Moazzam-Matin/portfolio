document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.querySelectorAll(".nav-links a");
    const sections = document.querySelectorAll("main section[id]");

    // Smooth scrolling for navigation links
    navLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            const targetId = link.getAttribute("href");

            if (!targetId || !targetId.startsWith("#")) {
                return;
            }

            const target = document.querySelector(targetId);

            if (!target) {
                return;
            }

            event.preventDefault();

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });
    });

    // Highlight the active navigation link while scrolling
    const updateActiveNav = () => {
        const scrollPosition = window.scrollY + 160;

        let currentSection = "";

        sections.forEach((section) => {
            const sectionTop = section.offsetTop;
            const sectionBottom = sectionTop + section.offsetHeight;

            if (
                scrollPosition >= sectionTop &&
                scrollPosition < sectionBottom
            ) {
                currentSection = section.id;
            }
        });

        navLinks.forEach((link) => {
            const targetId = link.getAttribute("href");

            link.classList.toggle(
                "active",
                targetId === `#${currentSection}`
            );
        });
    };

    window.addEventListener("scroll", updateActiveNav, {
        passive: true
    });

    updateActiveNav();
});