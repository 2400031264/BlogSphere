// ---------- State & helpers ----------
const app = document.getElementById('app');
const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// SQLite CURRENT_TIMESTAMP is UTC without a zone marker
const fmt = (d) => new Date(d.replace(' ', 'T') + 'Z').toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && state.token) logout(true);
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function setSession(token, user) {
  state.token = token; state.user = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}
function logout(silent) {
  state.token = null; state.user = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  if (!silent) toast('Logged out');
  location.hash = '#/login';
}

function renderNav() {
  const el = document.getElementById('nav-links');
  el.innerHTML = state.user
    ? `<a href="#/">Home</a><a href="#/new">Write</a><span class="meta">Hi, ${esc(state.user.username)}</span><a href="#" id="logout">Logout</a>`
    : `<a href="#/">Home</a><a href="#/login">Login</a><a href="#/register" class="btn small">Sign up</a>`;
  const lo = document.getElementById('logout');
  if (lo) lo.onclick = (e) => { e.preventDefault(); logout(); };
}

// ---------- Views ----------
async function homeView(query = {}) {
  const page = parseInt(query.page) || 1;
  const q = query.q || '';
  app.innerHTML = `
    <form class="search" id="search-form">
      <input name="q" placeholder="Search posts…" value="${esc(q)}" />
      <button class="btn">Search</button>
    </form>
    <div id="list"><p class="empty">Loading…</p></div>`;
  document.getElementById('search-form').onsubmit = (e) => {
    e.preventDefault();
    const v = new FormData(e.target).get('q').trim();
    location.hash = '#/' + (v ? `?q=${encodeURIComponent(v)}` : '');
  };
  try {
    const data = await api(`/posts?page=${page}&q=${encodeURIComponent(q)}`);
    const list = document.getElementById('list');
    if (!data.posts.length) { list.innerHTML = '<p class="empty">No posts found.</p>'; return; }
    const link = (p) => `#/?page=${p}${q ? '&q=' + encodeURIComponent(q) : ''}`;
    list.innerHTML = data.posts.map((p) => `
      <article class="card">
        <h2><a href="#/post/${p.id}">${esc(p.title)}</a></h2>
        <div class="meta">by ${esc(p.author)} · ${fmt(p.created_at)} · 💬 ${p.comment_count}</div>
        <p class="excerpt">${esc(p.content.length > 220 ? p.content.slice(0, 220) + '…' : p.content)}</p>
      </article>`).join('') + `
      <div class="pager">
        ${page > 1 ? `<a class="btn secondary small" href="${link(page - 1)}">← Prev</a>` : ''}
        <span class="meta">Page ${data.page} of ${data.pages}</span>
        ${page < data.pages ? `<a class="btn secondary small" href="${link(page + 1)}">Next →</a>` : ''}
      </div>`;
  } catch (e) { document.getElementById('list').innerHTML = `<p class="error">${esc(e.message)}</p>`; }
}

async function postView(id) {
  app.innerHTML = '<p class="empty">Loading…</p>';
  try {
    const [post, comments] = await Promise.all([api(`/posts/${id}`), api(`/posts/${id}/comments`)]);
    const mine = state.user && state.user.id === post.author_id;
    app.innerHTML = `
      <article class="card">
        <h2>${esc(post.title)}</h2>
        <div class="meta">by ${esc(post.author)} · ${fmt(post.created_at)}${post.updated_at !== post.created_at ? ' · edited' : ''}</div>
        <div class="post-body">${esc(post.content)}</div>
        ${mine ? `<div class="actions"><a class="btn secondary small" href="#/edit/${post.id}">Edit</a><button class="btn danger small" id="del-post">Delete</button></div>` : ''}
      </article>
      <section class="card">
        <h3 style="margin-top:0">Comments (<span id="ccount">${comments.length}</span>)</h3>
        <div id="comments"></div>
        <div id="comment-box"></div>
      </section>`;

    const renderComments = () => {
      document.getElementById('ccount').textContent = comments.length;
      document.getElementById('comments').innerHTML = comments.length
        ? comments.map((c) => `
          <div class="comment">
            <div class="head">
              <span><strong>${esc(c.author)}</strong> <span class="meta">· ${fmt(c.created_at)}</span></span>
              ${state.user && (state.user.id === c.user_id || mine) ? `<button class="btn danger small" data-del="${c.id}">Delete</button>` : ''}
            </div>
            <p>${esc(c.content)}</p>
          </div>`).join('')
        : '<p class="empty">No comments yet. Be the first!</p>';
      document.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
        try {
          await api(`/comments/${b.dataset.del}`, { method: 'DELETE' });
          comments.splice(comments.findIndex((c) => c.id == b.dataset.del), 1);
          renderComments(); toast('Comment deleted');
        } catch (e) { toast(e.message); }
      });
    };
    renderComments();

    const box = document.getElementById('comment-box');
    if (state.user) {
      box.innerHTML = `
        <form id="comment-form">
          <label for="ctext">Add a comment</label>
          <textarea id="ctext" required placeholder="Share your thoughts…"></textarea>
          <div class="error" id="cerr"></div>
          <button class="btn">Post comment</button>
        </form>`;
      document.getElementById('comment-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
          const c = await api(`/posts/${id}/comments`, { method: 'POST', body: { content: document.getElementById('ctext').value } });
          comments.push(c); renderComments(); e.target.reset(); toast('Comment added');
        } catch (err) { document.getElementById('cerr').textContent = err.message; }
      };
    } else {
      box.innerHTML = '<p class="meta"><a href="#/login">Log in</a> to join the discussion.</p>';
    }

    const del = document.getElementById('del-post');
    if (del) del.onclick = async () => {
      if (!confirm('Delete this post and all its comments?')) return;
      try { await api(`/posts/${id}`, { method: 'DELETE' }); toast('Post deleted'); location.hash = '#/'; }
      catch (e) { toast(e.message); }
    };
  } catch (e) { app.innerHTML = `<p class="error">${esc(e.message)}</p><a href="#/">← Back</a>`; }
}

async function editorView(id) {
  if (!state.user) { location.hash = '#/login'; return; }
  let post = { title: '', content: '' };
  if (id) {
    try {
      post = await api(`/posts/${id}`);
      if (post.author_id !== state.user.id) { toast('You can only edit your own posts'); location.hash = '#/'; return; }
    } catch (e) { app.innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }
  }
  app.innerHTML = `
    <form class="card form-card wide" id="post-form">
      <h2>${id ? 'Edit post' : 'New post'}</h2>
      <label for="title">Title</label>
      <input id="title" required maxlength="150" value="${esc(post.title)}" />
      <label for="content">Content</label>
      <textarea id="content" required style="min-height:260px">${esc(post.content)}</textarea>
      <div class="error" id="err"></div>
      <div class="actions"><button class="btn">${id ? 'Save changes' : 'Publish'}</button><a class="btn secondary" href="#/">Cancel</a></div>
    </form>`;
  document.getElementById('post-form').onsubmit = async (e) => {
    e.preventDefault();
    const body = { title: document.getElementById('title').value, content: document.getElementById('content').value };
    try {
      const saved = id ? await api(`/posts/${id}`, { method: 'PUT', body }) : await api('/posts', { method: 'POST', body });
      toast(id ? 'Post updated' : 'Post published');
      location.hash = `#/post/${saved.id}`;
    } catch (err) { document.getElementById('err').textContent = err.message; }
  };
}

function authView(mode) {
  const reg = mode === 'register';
  app.innerHTML = `
    <form class="card form-card" id="auth-form">
      <h2>${reg ? 'Create account' : 'Welcome back'}</h2>
      ${reg ? '<label for="username">Username</label><input id="username" required minlength="3" />' : ''}
      <label for="email">Email</label><input id="email" type="email" required />
      <label for="password">Password</label><input id="password" type="password" required minlength="6" />
      <div class="error" id="err"></div>
      <button class="btn" style="width:100%">${reg ? 'Sign up' : 'Log in'}</button>
      <p class="meta" style="text-align:center">${reg ? 'Already have an account? <a href="#/login">Log in</a>' : 'New here? <a href="#/register">Create an account</a>'}</p>
    </form>`;
  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const body = { email: document.getElementById('email').value, password: document.getElementById('password').value };
    if (reg) body.username = document.getElementById('username').value;
    try {
      const data = await api(`/auth/${reg ? 'register' : 'login'}`, { method: 'POST', body });
      setSession(data.token, data.user);
      toast(`Welcome, ${data.user.username}!`);
      location.hash = '#/';
    } catch (err) { document.getElementById('err').textContent = err.message; }
  };
}

// ---------- Router ----------
function route() {
  renderNav();
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  let m;
  if (path === '/' || path === '') homeView(query);
  else if ((m = path.match(/^\/post\/(\d+)$/))) postView(m[1]);
  else if (path === '/new') editorView();
  else if ((m = path.match(/^\/edit\/(\d+)$/))) editorView(m[1]);
  else if (path === '/login') authView('login');
  else if (path === '/register') authView('register');
  else app.innerHTML = '<p class="empty">Page not found. <a href="#/">Go home</a></p>';
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
