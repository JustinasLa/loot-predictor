// Shared DOM helpers for every renderer. Frozen after the foundation.

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** The first rarity of a combined label ("Legendary / Ultimate" -> "Legendary"). */
export function rarityTone(rarity) {
  return typeof rarity === "string" && rarity ? rarity.split(" / ")[0] : "None";
}

function initials(name, letters) {
  return name.split(/\s+/).slice(0, letters).map((part) => part[0]).join("").toUpperCase();
}

/**
 * Decorative game art with a readable initials fallback. The adjacent visible
 * name labels the artwork, so the image itself is silent.
 */
export function artwork(presentation, kind = "item", { letters = 2 } = {}) {
  const frame = el("span", `${kind}-art`);
  frame.setAttribute("aria-hidden", "true");
  const fallback = () => {
    frame.textContent = "";
    frame.classList.add("is-fallback");
    frame.append(el("span", `${kind}-fallback`, initials(presentation.name, letters)));
  };
  if (presentation.image) {
    const image = el("img", `${kind}-image`);
    image.src = presentation.image;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 64;
    image.height = 64;
    image.addEventListener("error", fallback, { once: true });
    frame.append(image);
  } else {
    fallback();
  }
  return frame;
}
