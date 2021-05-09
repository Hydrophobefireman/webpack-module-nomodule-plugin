module.exports.replaceAll = function (_this, str, newStr) {
  if (Object.prototype.toString.call(str).toLowerCase() === "[object regexp]") {
    return _this.replace(str, newStr);
  }
  return _this.replace(new RegExp(str, "g"), newStr);
};
