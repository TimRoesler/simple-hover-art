import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadHoverHandler({ specificArt, artType = "character" } = {}) {
  const handlers = new Map();
  const image = { src: "", style: {} };
  const video = { src: "", style: {}, play: () => Promise.resolve() };
  const caption = { textContent: "", style: {} };
  const activeClasses = new Set();
  const container = {
    style: {},
    classList: {
      add: (...names) => names.forEach((name) => activeClasses.add(name)),
      remove: (...names) => names.forEach((name) => activeClasses.delete(name)),
      contains: (name) => activeClasses.has(name)
    },
    querySelector(selector) {
      return { img: image, video, ".hover-art-caption": caption }[selector] ?? null;
    }
  };
  const context = {
    Hooks: {
      once: () => {},
      on: (event, handler) => handlers.set(event, handler)
    },
    game: {
      settings: {
        get: (_module, key) => ({
          enabled: true,
          permissionRequirement: "none",
          showNPCs: true,
          artType,
          hoverDelay: 0,
          cardSize: 250,
          imagePosition: "bottom-left",
          showName: true
        })[key]
      },
      user: { isGM: true }
    },
    document: { getElementById: () => container },
    setTimeout: (callback) => { callback(); return 1; },
    clearTimeout: () => {},
    console
  };

  vm.runInNewContext(fs.readFileSync("simple-hover-art.js", "utf8"), context);
  return {
    hover: handlers.get("hoverToken"),
    image
  };
}

test("uses token-specific art before the configured actor portrait", () => {
  const { hover, image } = loadHoverHandler({ specificArt: "assets/token-specific.webp" });
  const token = {
    id: "token-1",
    name: "Token One",
    actor: {
      img: "assets/actor-portrait.webp",
      hasPlayerOwner: true,
      testUserPermission: () => true
    },
    document: {
      getFlag: (scope, key) => {
        assert.equal(scope, "simple-hover-art");
        assert.equal(key, "specificArt");
        return "assets/token-specific.webp";
      },
      texture: { src: "assets/token-image.webp" }
    }
  };

  hover(token, true);

  assert.equal(image.src, "assets/token-specific.webp");
});

test("uses the configured art source when a token has no specific art", () => {
  const { hover, image } = loadHoverHandler({ specificArt: null });
  const token = {
    id: "token-2",
    name: "Token Two",
    actor: {
      img: "assets/actor-portrait.webp",
      hasPlayerOwner: true,
      testUserPermission: () => true
    },
    document: {
      getFlag: () => null,
      texture: { src: "assets/token-image.webp" }
    }
  };

  hover(token, true);

  assert.equal(image.src, "assets/actor-portrait.webp");
});
