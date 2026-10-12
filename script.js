const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const root = document.documentElement;

/* ===== Giao diện sáng / tối (nhớ lựa chọn của người xem) ===== */
const themeBtn = $('#theme');
const setTheme = t => {
  root.dataset.theme = t;
  themeBtn.textContent = t === 'dark' ? '🌙' : '☀️';
  try { localStorage.setItem('theme', t); } catch (e) {}
};
let saved = null;
try { saved = localStorage.getItem('theme'); } catch (e) {}
setTheme(saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
themeBtn.onclick = () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');

/* ===== Menu trên điện thoại ===== */
const nav = $('#nav');
$('#burger').onclick = () => nav.classList.toggle('open');
$$('#menu a').forEach(a => a.onclick = () => nav.classList.remove('open'));

/* ===== Thanh tiến trình cuộn + nền menu ===== */
const bar = $('#progress');
const onScroll = () => {
  const h = root.scrollHeight - innerHeight;
  bar.style.width = (h > 0 ? scrollY / h * 100 : 0) + '%';
  nav.classList.toggle('scrolled', scrollY > 20);
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ===== Hiện dần khi cuộn tới (so le theo thứ tự) ===== */
$$('.reveal').forEach(el => {
  const i = [...el.parentElement.children].filter(c => c.classList.contains('reveal')).indexOf(el);
  el.style.setProperty('--d', i * 0.12 + 's');
});
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('show'); io.unobserve(e.target); }
}), { threshold: 0.15 });
$$('.reveal').forEach(el => io.observe(el));

/* ===== Tô sáng mục menu đang xem ===== */
const links = $$('#menu a[href^="#"]');
const so = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
$$('main section').forEach(s => so.observe(s));

/* ===== Hiệu ứng gõ chữ (SỬA nội dung ở đây) ===== */
const words = ['Học sinh THPT Trung Phú', 'Thích khám phá công nghệ', 'Luôn học hỏi mỗi ngày'];
const typed = $('#typed');
let w = 0, c = 0, del = false;
(function tick() {
  const s = words[w];
  c += del ? -1 : 1;
  typed.textContent = s.slice(0, c);
  let d = del ? 35 : 70;
  if (!del && c === s.length) { del = true; d = 1400; }
  else if (del && c === 0) { del = false; w = (w + 1) % words.length; d = 300; }
  setTimeout(tick, d);
})();

/* ===== Thẻ nghiêng 3D theo con trỏ (chỉ trên máy có chuột) ===== */
if (matchMedia('(hover: hover)').matches) {
  $$('.tilt').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
    });
    el.addEventListener('pointerleave', () => el.style.transform = '');
  });
}

/* ===== Tuổi tự cập nhật (sinh 09/03/2010) + năm ở chân trang ===== */
const now = new Date();
let age = now.getFullYear() - 2010;
if (now < new Date(now.getFullYear(), 2, 9)) age--;
$('#age').textContent = '(' + age + ' tuổi)';
$('#year').textContent = now.getFullYear();
