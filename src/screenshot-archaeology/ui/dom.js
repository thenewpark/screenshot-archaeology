export const $ = (id) => document.getElementById(id);

export const el = (tag, text, cls) => {
  const n = document.createElement(tag);

  if (text !== undefined) {
    n.textContent = text;
  }
  if (cls) {
    n.className = cls;
  }
  return n;
};
