(function () {
  function createIcon(name) {
    var i = document.createElement("i");
    i.className = name;
    return i;
  }

  function enhanceHeaderNav() {
    var headers = document.querySelectorAll(".site-header, .app-header");
    headers.forEach(function (header) {
      var nav = header.querySelector(".main-nav");
      var content = header.querySelector(".header-content") || header;
      if (!nav || !content || content.querySelector(".fw-nav-toggle")) {
        return;
      }

      var toggle = document.createElement("button");
      toggle.className = "fw-nav-toggle";
      toggle.type = "button";
      toggle.setAttribute("aria-label", "Toggle navigation menu");
      toggle.setAttribute("aria-expanded", "false");
      toggle.appendChild(createIcon("fas fa-bars"));

      toggle.addEventListener("click", function () {
        var open = header.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", String(open));
        var icon = toggle.querySelector("i");
        if (icon) {
          icon.className = open ? "fas fa-times" : "fas fa-bars";
        }
      });

      content.appendChild(toggle);
    });
  }

  function enhanceSidebar() {
    var sidebar = document.querySelector(".sidebar");
    var mainContent = document.querySelector(".main-content");
    var header = document.querySelector(".main-content .header") || document.querySelector(".header");
    if (!sidebar || !mainContent || !header || document.querySelector(".fw-sidebar-toggle")) {
      return;
    }

    var toggle = document.createElement("button");
    toggle.className = "fw-sidebar-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Open sidebar menu");
    toggle.innerHTML = '<i class="fas fa-bars"></i> Menu';

    toggle.addEventListener("click", function () {
      document.body.classList.toggle("sidebar-open");
    });

    header.insertAdjacentElement("beforebegin", toggle);

    document.addEventListener("click", function (event) {
      if (!document.body.classList.contains("sidebar-open")) {
        return;
      }
      var clickedInsideSidebar = sidebar.contains(event.target);
      var clickedToggle = toggle.contains(event.target);
      if (!clickedInsideSidebar && !clickedToggle) {
        document.body.classList.remove("sidebar-open");
      }
    });
  }

  function closeMenusOnResize() {
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1024) {
        document.body.classList.remove("sidebar-open");
        document.querySelectorAll(".site-header.nav-open").forEach(function (header) {
          header.classList.remove("nav-open");
          var toggle = header.querySelector(".fw-nav-toggle");
          if (toggle) {
            toggle.setAttribute("aria-expanded", "false");
            var icon = toggle.querySelector("i");
            if (icon) {
              icon.className = "fas fa-bars";
            }
          }
        });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    enhanceHeaderNav();
    enhanceSidebar();
    closeMenusOnResize();
  });
})();
