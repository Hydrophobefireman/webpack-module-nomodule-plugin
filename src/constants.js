exports.loadScript =
  'function $(e,d,c){c=document.createElement("script"),"noModule" in c?(e && (c.src=e,c.type="module",c.crossOrigin="anonymous")):d && (c.src=d),c.src && document.head.appendChild(c)}';

exports.ID = "html-webpack-esmodules-plugin";
exports.OUTPUT_MODES = {
  EFFICIENT: "efficient",
  MINIMAL: "minimal",
};