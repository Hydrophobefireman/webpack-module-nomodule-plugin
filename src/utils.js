const { loadScript } = require("./constants");

exports.makeLoadScript = (modern, legacy) => `
  addEventListener('DOMContentLoaded',function() {
  ${loadScript}
  ${(modern.length > legacy.length ? modern : legacy)
    .reduce(
      (acc, _m, i) => `
${acc}$(${modern[i] ? `"${modern[i].attributes.src}"` : 0},${
        legacy[i] ? `"${legacy[i].attributes.src}"` : 0
      })
  `,
      ""
    )
    .trim()}
})`;
