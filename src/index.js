"use strict";

const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const fs = require("fs-extra");
const { OUTPUT_MODES, ID } = require("./constants");
const { makeLoadScript } = require("./utils");
const { inlineFont, fontAsLinkTag } = require("./extra/font-util");

const opts = {
  module: "modern",
  modern: "modern",
  nomodule: "legacy",
  legacy: "legacy",
};
const defaultConfig = { inlineFontCss: true };
class HtmlWebpackEsmodulesPlugin {
  constructor({
    mode = "modern",
    outputMode = OUTPUT_MODES.EFFICIENT,
    preload = true,
    fonts = [],
  }) {
    this._fonts = fonts;
    this._inlineFonts = process.env.NODE_ENV === "production";
    this.outputMode = outputMode;
    this.preload = preload;
    this.mode = opts[mode];
    if (!this.mode) {
      throw new Error(
        `The mode has to be one of: [modern, legacy, module, nomodule], you provided ${mode}.`
      );
    }
  }

  apply(compiler) {
    compiler.hooks.compilation.tap(ID, (compilation) => {
      // Support newest and oldest version.
      if (HtmlWebpackPlugin.getHooks) {
        HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tapAsync(
          { name: ID, stage: Infinity },
          this.alterAssetTagGroups.bind(this, compiler)
        );
        if (this.outputMode === OUTPUT_MODES.MINIMAL) {
          HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tap(
            ID,
            this.beforeEmitHtml.bind(this)
          );
        }
      } else {
        compilation.hooks.htmlWebpackPluginAlterAssetTags.tapAsync(
          { name: ID, stage: Infinity },
          this.alterAssetTagGroups.bind(this, compiler)
        );
        if (this.outputMode === OUTPUT_MODES.MINIMAL) {
          compilation.hooks.htmlWebpackPluginAfterHtmlProcessing.tap(
            ID,
            this.beforeEmitHtml.bind(this)
          );
        }
      }
    });
  }

  alterAssetTagGroups(
    compiler,
    { plugin, bodyTags: body, headTags: head, ...rest },
    cb
  ) {
    // Older webpack compat
    if (!body) body = rest.body;
    if (!head) head = rest.head;

    const targetDir = compiler.options.output.path;
    // get stats, write to disk
    const htmlName = path.basename(plugin.options.filename);
    // Watch out for output files in sub directories
    const htmlPath = path.dirname(plugin.options.filename);
    // Make the temporairy html to store the scripts in
    const tempFilename = path.join(
      targetDir,
      htmlPath,
      `assets-${htmlName}.json`
    );
    // If this file does not exist we are in iteration 1
    if (!fs.existsSync(tempFilename)) {
      fs.mkdirpSync(path.dirname(tempFilename));
      // Only keep the scripts so we can't add css etc twice.
      const newBody = body.filter(
        (a) => a.tagName === "script" && a.attributes
      );
      if (this.mode === "legacy") {
        // Empty nomodule in legacy build
        newBody.forEach((a) => {
          a.attributes.nomodule = "";
        });
      } else {
        // Module in the new build
        newBody.forEach((a) => {
          a.attributes.type = "module";
          a.attributes.crossOrigin = "anonymous";
        });
      }
      // Write it!
      fs.writeFileSync(tempFilename, JSON.stringify(newBody));
      // Tell the compiler to continue.
      !this._inlineFonts &&
        this._fonts &&
        this._fonts.map((x) => head.push(...fontAsLinkTag(x)));
      return cb();
    }

    // Draw the existing html because we are in iteration 2.
    const existingAssets = JSON.parse(fs.readFileSync(tempFilename, "utf-8"));

    if (this.mode === "modern") {
      // If we are in modern make the type a module.
      body.forEach((tag) => {
        if (tag.tagName === "script" && tag.attributes) {
          tag.attributes.type = "module";
          tag.attributes.crossOrigin = "anonymous";
        }
      });
    } else {
      // If we are in legacy fill nomodule.
      body.forEach((tag) => {
        if (tag.tagName === "script" && tag.attributes) {
          tag.attributes.nomodule = "";
        }
      });
    }

    if (this.outputMode === OUTPUT_MODES.MINIMAL) {
      this.sizeEfficient(existingAssets, body);
    } else if (this.outputMode === OUTPUT_MODES.EFFICIENT) {
      this.downloadEfficient(existingAssets, body, head);
    }

    fs.removeSync(tempFilename);
    if (this._inlineFonts) {
      console.log("Inlining fonts");
      Promise.all(
        this._fonts.map(async (font) => {
          head.push(...(await inlineFont(font)));
        })
      ).then(() => cb());
    } else {
      console.log("Keeping fonts as link tags");
      this._fonts.map((x) => head.push(...fontAsLinkTag(x)));
      cb();
    }
  }

  beforeEmitHtml(data) {
    data.html = data.html.replace(/\snomodule="">/g, " nomodule>");
  }

  downloadEfficient(existingAssets, body, head) {
    const isModern = this.mode === "modern";
    const legacyScripts = (isModern ? existingAssets : body).filter(
      (tag) => tag.tagName === "script" && tag.attributes.type !== "module"
    );
    const modernScripts = (isModern ? body : existingAssets).filter(
      (tag) => tag.tagName === "script" && tag.attributes.type === "module"
    );
    const scripts = body.filter((tag) => tag.tagName === "script");
    scripts.forEach((s) => {
      body.splice(body.indexOf(s), 1);
    });

    modernScripts.forEach((modernScript) => {
      if (this.preload)
        head.push({
          tagName: "link",
          attributes: {
            rel: "modulepreload",
            href: modernScript.attributes.src,
          },
        });
    });

    const loadScript = makeLoadScript(modernScripts, legacyScripts);
    head.push({ tagName: "script", innerHTML: loadScript, voidTag: false });
  }

  sizeEfficient(existingAssets, body) {
    // Make our array look like [modern, script, legacy]
    if (this.mode === "legacy") {
      body.unshift(...existingAssets);
    } else {
      body.push(...existingAssets);
    }
  }
}

exports.OUTPUT_MODES = OUTPUT_MODES;
module.exports = HtmlWebpackEsmodulesPlugin;
