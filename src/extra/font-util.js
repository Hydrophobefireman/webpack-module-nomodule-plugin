const fetch = require("node-fetch");

const urlReg = /url\s*\((\s*["']?)\s*(\/)(?!\/)/gm;
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 8.0; Pixel 2 Build/OPD3.170816.012) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4496.0 Mobile Safari/537.36";
/**
 *
 * @param {import("./types").HtmlTagObject} tag
 */
async function inlineFont({ href, ...rest }) {
  try {
    if (href.startsWith("http")) {
      console.log("GET:", href);
      const u = new URL(href);
      const orig = u.origin;
      const response = await fetch(href, {
        headers: { "user-agent": USER_AGENT },
      });
      const text = await response.text();

      const tag = {
        tagName: "style",
        voidTag: false,
        innerHTML: text.replace(urlReg, function relativeToAbsolute(match) {
          const doubleQuote = match.includes('"') ? '"' : "";
          const singleQuote = match.includes("'") ? "'" : "";
          return `url(${doubleQuote}${singleQuote}${orig}/`;
        }),
        attributes: {
          "data-extract": href,
          "data-extract-ts": +new Date(),
        },
      };
      return [tag];
    }
  } catch (e) {
    console.error("Caught:", e);
    console.warn("Skipping:", tag);
    return fontAsLinkTag({ href, ...rest });
  }
}
/** */
function fontAsLinkTag(attributes) {
  const { href, ...rest } = attributes;
  const preloadAttributes = { href, rel: "preload", as: "style" };
  const stylesheetAttributes = {
    href,
    rel: "stylesheet",
    media: "print",
    onload: "this.media='all'",
  };
  return [
    {
      tagName: "link",
      attributes: Object.assign(stylesheetAttributes, rest),
      voidTag: true,
    },
    {
      tagName: "link",
      attributes: Object.assign(preloadAttributes, rest),
      voidTag: true,
    },
  ];
}
module.exports.fontAsLinkTag = fontAsLinkTag;
module.exports.inlineFont = inlineFont;
