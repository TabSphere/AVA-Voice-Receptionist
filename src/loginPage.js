// Self-contained login / first-run setup page, served at GET /login.
export const LOGIN_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AVA · Sign in</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(1200px 700px at 50% -10%, #26221d 0%, #16141a 55%, #100f13 100%);
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: #e7e5e4;
    padding: 24px;
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(18px) scale(0.985); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 28px rgba(245,158,11,.35), 0 0 64px rgba(245,158,11,.12); }
    50%      { box-shadow: 0 0 40px rgba(245,158,11,.5), 0 0 90px rgba(245,158,11,.2); }
  }
  .card {
    width: 100%;
    max-width: 380px;
    background: rgba(28,26,30,.92);
    border: 1px solid rgba(245,158,11,.14);
    border-radius: 20px;
    padding: 40px 32px 28px;
    text-align: center;
    box-shadow: 0 24px 60px rgba(0,0,0,.5);
    animation: rise .55s cubic-bezier(.22,1,.36,1) both;
  }
  .logo {
    width: 64px; height: 64px;
    margin: 0 auto 18px;
    border-radius: 18px;
    background: linear-gradient(135deg, #fbbf24, #d97706);
    color: #1c1917;
    font-size: 32px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    animation: glow 3.2s ease-in-out infinite, rise .6s .05s cubic-bezier(.22,1,.36,1) both;
  }
  h1 { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.02em; animation: rise .55s .1s both; }
  .sub { margin-top: 6px; font-size: 13px; color: #a8a29e; animation: rise .55s .15s both; }
  form { margin-top: 26px; text-align: left; animation: rise .55s .2s both; }
  label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #a8a29e; margin: 14px 0 6px; }
  input {
    width: 100%;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid #3f3a35;
    background: #141214;
    color: #fff;
    font-size: 15px;
    font-family: inherit;
    outline: none;
    transition: border-color .15s, box-shadow .15s;
  }
  input:focus { border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,.18); }
  button {
    width: 100%;
    margin-top: 22px;
    padding: 13px;
    border: 0;
    border-radius: 12px;
    background: linear-gradient(135deg, #fbbf24, #d97706);
    color: #1c1917;
    font-size: 15px; font-weight: 800;
    font-family: inherit;
    cursor: pointer;
    transition: transform .12s, filter .12s;
  }
  button:hover { filter: brightness(1.06); transform: translateY(-1px); }
  button:disabled { opacity: .6; cursor: wait; transform: none; }
  .error {
    display: none;
    margin-top: 14px;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(239,68,68,.12);
    border: 1px solid rgba(239,68,68,.35);
    color: #fca5a5;
    font-size: 13px; font-weight: 600;
  }
  .note { margin-top: 16px; font-size: 12px; color: #78716c; line-height: 1.5; }
  footer { margin-top: 26px; font-size: 11px; color: #57534e; animation: rise .55s .3s both; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">A</div>
    <h1 id="title">AVA</h1>
    <p class="sub" id="subtitle">Voice Receptionist Dashboard</p>
    <form id="form" autocomplete="off">
      <div id="fields"></div>
      <div class="error" id="error"></div>
      <button type="submit" id="submit">Sign in</button>
      <p class="note" id="note" style="display:none">This protects your dashboard — you'll use this password to sign in.</p>
    </form>
    <footer>TabSphere Limited · AVA Voice Receptionist</footer>
  </div>
<script>
(async function () {
  const fields = document.getElementById('fields');
  const err = document.getElementById('error');
  const btn = document.getElementById('submit');
  const note = document.getElementById('note');
  const title = document.getElementById('title');
  let mode = 'login';
  // Branding: swap the default amber "A" mark for the uploaded logo (if any).
  try {
    const b = await fetch('/api/public/branding').then(r => r.json());
    if (b && b.logoDataUrl) {
      const logo = document.querySelector('.logo');
      const img = document.createElement('img');
      img.src = b.logoDataUrl;
      img.alt = (b.businessName || 'Business') + ' logo';
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:14px;background:#fff;padding:6px;';
      logo.textContent = '';
      logo.style.background = 'transparent';
      logo.style.animation = 'rise .6s .05s cubic-bezier(.22,1,.36,1) both';
      logo.appendChild(img);
    }
    if (b && b.businessName) {
      document.getElementById('subtitle').textContent = b.businessName + ' · Voice Receptionist Dashboard';
    }
  } catch (e) {}
  try {
    const st = await fetch('/api/auth/status').then(r => r.json());
    if (!st.setup) mode = 'setup';
    if (st.setup && st.authed) { location.href = '/'; return; }
  } catch (e) {}
  if (mode === 'setup') {
    title.textContent = 'Create your password';
    btn.textContent = 'Create password';
    note.style.display = 'block';
    fields.innerHTML =
      '<label for="pw">Password</label><input id="pw" name="pw" type="password" minlength="8" required autofocus />' +
      '<label for="pw2">Confirm password</label><input id="pw2" name="pw2" type="password" minlength="8" required />';
  } else {
    title.textContent = 'Sign in';
    fields.innerHTML =
      '<label for="pw">Password</label><input id="pw" name="pw" type="password" required autofocus />';
  }
  document.getElementById('form').addEventListener('submit', async function (e) {
    e.preventDefault();
    err.style.display = 'none';
    const pw = document.getElementById('pw').value;
    if (mode === 'setup') {
      if (pw !== document.getElementById('pw2').value) {
        err.textContent = 'Passwords do not match'; err.style.display = 'block'; return;
      }
    }
    btn.disabled = true;
    try {
      const r = await fetch('/api/auth/' + mode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { location.href = '/'; return; }
      err.textContent = j.error || (r.status === 401 ? 'Incorrect password' : 'Something went wrong');
      err.style.display = 'block';
    } catch (ex) {
      err.textContent = 'Network error — please try again';
      err.style.display = 'block';
    }
    btn.disabled = false;
  });
})();
</script>
</body>
</html>
`;
