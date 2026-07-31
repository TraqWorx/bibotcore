/* BELLESSERE — waiting-list floating CTA for the GHL booking widget.
   Fully self-styled inline (GHL doesn't apply the custom stylesheet on
   every widget step). Loaded by the widget custom code via <script src>. */
(function () {
  var LINK = "https://ghlcustomdash.com/designs/bellessere/lista-attesa";

  function styleCta(a) {
    var s = a.style;
    s.position = "fixed";
    s.zIndex = "99999";
    s.display = "inline-flex";
    s.alignItems = "center";
    s.gap = "7px";
    s.whiteSpace = "nowrap";
    s.maxWidth = "calc(100vw - 24px)";
    s.background = "linear-gradient(180deg, #1A1713, #0B0907)";
    s.color = "#ffffff";
    s.textDecoration = "none";
    s.fontFamily = "-apple-system, BlinkMacSystemFont, sans-serif";
    s.fontWeight = "700";
    s.borderRadius = "100px";
    s.border = "1px solid #D2AB4B";
    s.boxShadow = "0 10px 28px rgba(11,9,7,0.30)";
    var small = window.innerWidth <= 640;
    s.fontSize = small ? "12px" : "13.5px";
    s.padding = small ? "10px 16px" : "12px 22px";
  }

  function buildCta() {
    var a = document.createElement("a");
    a.id = "bs-waitlist-cta";
    a.href = LINK;
    a.target = "_blank";
    a.rel = "noopener";
    var plain = document.createElement("span");
    plain.textContent = "Non trovi posto?";
    var bold = document.createElement("b");
    bold.textContent = "Mettiti in lista d'attesa";
    bold.style.color = "#E7C87A";
    bold.style.fontWeight = "800";
    a.appendChild(plain);
    a.appendChild(bold);
    styleCta(a);
    return a;
  }

  var typing = false;

  function place() {
    var a = document.getElementById("bs-waitlist-cta");
    if (!a) {
      if (!document.body) return;
      a = buildCta();
      document.body.appendChild(a);
    }
    if (typing) { a.style.display = "none"; return; }
    a.style.display = "inline-flex";

    var small = window.innerWidth <= 640;
    var bar = document.querySelector(".service-menu-widget-action-container");
    var r = bar ? bar.getBoundingClientRect() : null;
    var barVisible = r && r.height > 0 && r.top > 0 && r.top < window.innerHeight;

    if (!small && barVisible) {
      // Desktop with the action bar on screen: sit INSIDE the bar, centered in
      // the empty space between Indietro (left) and Continua (right).
      a.style.left = Math.round(r.left + r.width / 2) + "px";
      a.style.transform = "translateX(-50%)";
      var pillH = a.offsetHeight || 41;
      var inBar = Math.round((window.innerHeight - r.bottom) + (r.height - pillH) / 2);
      a.style.bottom = Math.max(0, inBar) + "px";
      return;
    }

    // Mobile: centered pill floating above the bar. Desktop without a bar
    // (service list screen): bottom-left, out of the content's way.
    if (small) {
      a.style.left = "50%";
      a.style.transform = "translateX(-50%)";
    } else {
      a.style.left = "24px";
      a.style.transform = "none";
    }
    var lift = 16;
    if (barVisible) lift = Math.max(16, Math.round(window.innerHeight - r.top + 12));
    a.style.bottom = "calc(" + lift + "px + env(safe-area-inset-bottom))";
  }

  document.addEventListener("focusin", function (e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { typing = true; place(); }
  });
  document.addEventListener("focusout", function () {
    setTimeout(function () {
      var el = document.activeElement;
      if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) { typing = false; place(); }
    }, 150);
  });

  window.addEventListener("resize", place);
  setInterval(place, 600);

  if (document.readyState !== "loading") place();
  else document.addEventListener("DOMContentLoaded", place);
})();
