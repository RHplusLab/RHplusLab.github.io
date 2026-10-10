// 페이지 목차(왼쪽 메뉴에 통합된 부분)에 +/- 접기 버튼을 붙인다.
// 하위 소제목이 있는 항목만 대상. 기본은 접힘, 스크롤 위치의 항목은 자동으로 펼침.
(function () {
  function setup() {
    var toc = document.querySelector(".md-nav--primary .md-nav--secondary");
    if (!toc) return;

    toc.querySelectorAll(".md-nav__item").forEach(function (li) {
      var link = li.querySelector(":scope > .md-nav__link");
      if (!link || !li.querySelector(":scope > .md-nav")) return;

      li.classList.add("toc-collapsible");
      var btn = document.createElement("span");
      btn.className = "toc-toggle";
      btn.setAttribute("role", "button");
      btn.setAttribute("aria-label", "펼치기/접기");
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        li.classList.toggle("toc-open");
      });
      link.insertBefore(btn, link.firstChild);
    });

    // 스크롤로 활성화된 소제목의 상위 항목을 펼친다.
    // 이미 펼쳐진 항목은 건드리지 않는다 — classList.add는 값이 같아도 class 변경으로
    // 기록되어 MutationObserver가 다시 호출되므로, 무조건 add하면 무한 루프가 된다.
    function openActive() {
      toc.querySelectorAll(".md-nav__link--active").forEach(function (a) {
        var li = a.closest(".toc-collapsible");
        while (li) {
          if (!li.classList.contains("toc-open")) li.classList.add("toc-open");
          li = li.parentElement.closest(".toc-collapsible");
        }
      });
    }
    openActive();
    new MutationObserver(openActive).observe(toc, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
