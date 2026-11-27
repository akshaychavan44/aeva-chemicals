(() => {
  const form = document.getElementById("inquiryForm");
  const button = form.querySelector('[type="submit"]');
  const status = form.querySelector('[role="status"]');
  let lastPayload, id;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (button.disabled) return;
    const details = Object.fromEntries(new FormData(form));
    const payload = JSON.stringify(details);
    if (payload !== lastPayload) id = crypto.randomUUID();
    lastPayload = payload;
    button.disabled = true;
    status.hidden = false;
    status.textContent = "Sending your inquiry…";
    try {
      const endpoint = location.hostname === "akshaychavan44.github.io"
        ? "https://aeva-chemicals.vercel.app/api/inquiry" : "/api/inquiry";
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...details, id })
      });
      if (!response.ok || !(await response.json()).received) throw new Error();
      status.textContent = "Thank you. The Aeva Chemicals team has received your inquiry.";
      form.reset();
      lastPayload = null;
    } catch {
      status.textContent = "Your inquiry could not be confirmed. Please try again or email info@aevachemicals.com.";
    } finally {
      button.disabled = false;
    }
  });
})();
