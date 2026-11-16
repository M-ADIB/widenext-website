/* Lead form: demo stub. Validates in the browser and shows a confirmation.
   It sends nothing and stores nothing. Wire a real endpoint before launch. */
(function () {
  var form = document.querySelector("form[data-lead-form]");
  if (!form) return;
  var done = document.querySelector("[data-form-done]");
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var phoneRe = /^[+\d][\d\s()-]{6,}$/;

  function errorFor(field) {
    var v = (field.value || "").trim();
    if (field.required && !v) return field.getAttribute("data-msg") || "This field is required.";
    if (v && field.type === "email" && !emailRe.test(v)) return "Enter a valid email, like name@company.com.";
    if (v && field.type === "tel" && !phoneRe.test(v)) return "Enter a valid phone number, like +966 5X XXX XXXX.";
    if (field.name === "brief" && v && v.length < 20) return "Give us a little more, at least 20 characters.";
    return "";
  }

  function show(field, msg) {
    var box = document.getElementById(field.id + "-err");
    field.setAttribute("aria-invalid", msg ? "true" : "false");
    if (box) box.textContent = msg;
  }

  form.addEventListener("input", function (e) {
    var f = e.target;
    if (f.getAttribute("aria-invalid") === "true") show(f, errorFor(f));
  });
  form.addEventListener("focusout", function (e) {
    var f = e.target;
    if (f.matches("input, select, textarea") && f.value) show(f, errorFor(f));
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var first = null;
    form.querySelectorAll("input, select, textarea").forEach(function (f) {
      if (f.type === "hidden") return;
      var msg = errorFor(f);
      show(f, msg);
      if (msg && !first) first = f;
    });
    if (first) {
      first.focus();
      return;
    }
    var name = (form.elements.name.value || "").trim().split(" ")[0];
    form.hidden = true;
    if (done) {
      var who = done.querySelector("[data-form-name]");
      if (who) who.textContent = name;
      done.hidden = false;
      done.focus();
    }
  });
})();
