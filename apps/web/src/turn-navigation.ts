export function bindTurnBackToTop() {
  const button = document.querySelector<HTMLButtonElement>('#turnBackToTop');
  if (!button) return;
  const updateVisibility = () => {
    button.hidden = window.scrollY < 600;
  };
  updateVisibility();
  window.addEventListener('scroll', updateVisibility, { passive: true });
  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
