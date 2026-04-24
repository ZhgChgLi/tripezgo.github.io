(function () {
  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatRemaining(distance) {
    var totalSeconds = Math.max(0, Math.floor(distance / 1000));
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;

    if (days > 0) {
      return "優惠倒數 " + days + " 天 " + pad(hours) + " 小時 " + pad(minutes) + " 分 " + pad(seconds) + " 秒";
    }

    return "優惠倒數 " + pad(hours) + " 小時 " + pad(minutes) + " 分 " + pad(seconds) + " 秒";
  }

  function updateCountdowns() {
    var now = Date.now();
    var countdowns = document.querySelectorAll("[data-offer-ends-at]");

    countdowns.forEach(function (node) {
      var textNode = node.querySelector(".count-text") || node;
      var endAt = Date.parse(node.dataset.offerEndsAt);

      if (Number.isNaN(endAt)) {
        node.hidden = true;
        return;
      }

      var distance = endAt - now;

      if (distance <= 0) {
        node.hidden = true;
        return;
      }

      node.hidden = false;
      textNode.textContent = formatRemaining(distance);
      node.classList.remove("is-expired", "is-muted");
    });
  }

  function shuffle(nodes) {
    var items = Array.prototype.slice.call(nodes);

    for (var index = items.length - 1; index > 0; index -= 1) {
      var randomIndex = Math.floor(Math.random() * (index + 1));
      var item = items[index];
      items[index] = items[randomIndex];
      items[randomIndex] = item;
    }

    return items;
  }

  function randomizeArticles() {
    var groups = document.querySelectorAll("[data-random-articles]");

    groups.forEach(function (group) {
      var limit = Number.parseInt(group.dataset.randomLimit || "3", 10);
      var articles = shuffle(group.querySelectorAll(".article"));

      articles.forEach(function (article, index) {
        article.hidden = index >= limit;

        if (!article.hidden) {
          group.appendChild(article);
        }
      });
    });
  }

  randomizeArticles();
  updateCountdowns();
  window.setInterval(updateCountdowns, 1000);
})();
