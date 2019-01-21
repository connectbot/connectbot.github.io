window.addEventListener("DOMContentLoaded", function() {
  var sidebar = document.getElementById("sidebar");
  var sidebarButton = document.getElementById("sidebar-button");

  function openSidebar(e) {
    if (sidebar.className.indexOf("slide-in") != -1) {
      sidebar.className = sidebar.className.replace(" slide-in", "");
    } else {
     sidebar.className = sidebar.className + " slide-in"; 
    }
  }

  sidebarButton.addEventListener("click", openSidebar, false);
});
