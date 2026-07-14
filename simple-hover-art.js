// Simple Hover Art Module for Foundry VTT V14
// Displays character art in the bottom-left corner of the screen when hovering over a token.

let hoverTimer = null;
let fadeOutTimer = null;
let activeTokenId = null;

// Immediately hide and clear the hover art card (no fade), e.g. when its token is deleted
function clearHoverArt() {
  const container = document.getElementById("hover-art-display-container");
  if (container) {
    container.classList.remove("active");
    const imgEl = container.querySelector("img");
    const videoEl = container.querySelector("video");
    if (imgEl) { imgEl.src = ""; imgEl.style.display = "none"; }
    if (videoEl) { videoEl.src = ""; videoEl.style.display = "none"; }
  }
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
  if (fadeOutTimer) { clearTimeout(fadeOutTimer); fadeOutTimer = null; }
  activeTokenId = null;
}

Hooks.once("init", () => {
  console.log("SimpleHoverArt | Initializing Simple Hover Art Module");

  // Register settings
  game.settings.register("simple-hover-art", "enabled", {
    name: game.i18n.localize("SIMPLE_HOVER_ART.SettingsEnabledName"),
    hint: game.i18n.localize("SIMPLE_HOVER_ART.SettingsEnabledHint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("simple-hover-art", "artType", {
    name: game.i18n.localize("SIMPLE_HOVER_ART.SettingsArtTypeName"),
    hint: game.i18n.localize("SIMPLE_HOVER_ART.SettingsArtTypeHint"),
    scope: "client",
    config: true,
    type: String,
    default: "character",
    choices: {
      "character": game.i18n.localize("SIMPLE_HOVER_ART.SettingsArtTypeChar"),
      "token": game.i18n.localize("SIMPLE_HOVER_ART.SettingsArtTypeToken")
    }
  });

  game.settings.register("simple-hover-art", "permissionRequirement", {
    name: game.i18n.localize("SIMPLE_HOVER_ART.SettingsPermissionName"),
    hint: game.i18n.localize("SIMPLE_HOVER_ART.SettingsPermissionHint"),
    scope: "world",
    config: true,
    type: String,
    default: "none",
    choices: {
      "none": game.i18n.localize("SIMPLE_HOVER_ART.SettingsPermissionNone"),
      "observer": game.i18n.localize("SIMPLE_HOVER_ART.SettingsPermissionObserver"),
      "owner": game.i18n.localize("SIMPLE_HOVER_ART.SettingsPermissionOwner")
    }
  });

  game.settings.register("simple-hover-art", "hoverDelay", {
    name: game.i18n.localize("SIMPLE_HOVER_ART.SettingsDelayName"),
    hint: game.i18n.localize("SIMPLE_HOVER_ART.SettingsDelayHint"),
    scope: "client",
    config: true,
    type: Number,
    default: 200,
    range: {
      min: 0,
      max: 1000,
      step: 50
    }
  });

  game.settings.register("simple-hover-art", "showName", {
    name: game.i18n.localize("SIMPLE_HOVER_ART.SettingsShowNameLabelName"),
    hint: game.i18n.localize("SIMPLE_HOVER_ART.SettingsShowNameLabelHint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("simple-hover-art", "showNPCs", {
    name: game.i18n.localize("SIMPLE_HOVER_ART.SettingsShowNPCsName"),
    hint: game.i18n.localize("SIMPLE_HOVER_ART.SettingsShowNPCsHint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("simple-hover-art", "cardSize", {
    name: game.i18n.localize("SIMPLE_HOVER_ART.SettingsCardSizeName"),
    hint: game.i18n.localize("SIMPLE_HOVER_ART.SettingsCardSizeHint"),
    scope: "client",
    config: true,
    type: Number,
    default: 250,
    range: {
      min: 150,
      max: 500,
      step: 10
    }
  });

  game.settings.register("simple-hover-art", "imagePosition", {
    name: game.i18n.localize("SIMPLE_HOVER_ART.SettingsPositionName"),
    hint: game.i18n.localize("SIMPLE_HOVER_ART.SettingsPositionHint"),
    scope: "client",
    config: true,
    type: String,
    default: "bottom-left",
    choices: {
      "bottom-left": game.i18n.localize("SIMPLE_HOVER_ART.SettingsPositionBottomLeft"),
      "bottom-right": game.i18n.localize("SIMPLE_HOVER_ART.SettingsPositionBottomRight"),
      "top-left": game.i18n.localize("SIMPLE_HOVER_ART.SettingsPositionTopLeft"),
      "top-right": game.i18n.localize("SIMPLE_HOVER_ART.SettingsPositionTopRight")
    }
  });
});

Hooks.once("ready", () => {
  // Inject container if it doesn't exist
  if (!document.getElementById("hover-art-display-container")) {
    const container = document.createElement("div");
    container.id = "hover-art-display-container";
    container.innerHTML = `
      <img class="hover-art-media" style="display: none;" />
      <video class="hover-art-media" style="display: none;" autoplay loop muted></video>
      <div class="hover-art-caption"></div>
    `;
    document.body.appendChild(container);
  }
});

// Hide the card when changing scenes or re-initializing the canvas
Hooks.on("canvasInit", () => {
  clearHoverArt();
});

// Hide the card immediately if the token whose art is shown gets deleted
Hooks.on("deleteToken", (tokenDoc) => {
  if (activeTokenId && tokenDoc.id === activeTokenId) {
    clearHoverArt();
  }
});

Hooks.on("hoverToken", (token, hovered) => {
  const container = document.getElementById("hover-art-display-container");
  if (!container) return;

  // Clear the fade-out timer if user hovered back on a token
  if (fadeOutTimer) {
    clearTimeout(fadeOutTimer);
    fadeOutTimer = null;
  }

  // Clear any pending show timers
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }

  // If we are leaving the token, fade out the card
  if (!hovered) {
    if (container.classList.contains("active")) {
      container.classList.remove("active");
      // Set a timer to clear the src after the fade out completes (transition is 0.25s)
      fadeOutTimer = setTimeout(() => {
        const imgEl = container.querySelector("img");
        const videoEl = container.querySelector("video");
        if (imgEl) { imgEl.src = ""; imgEl.style.display = "none"; }
        if (videoEl) { videoEl.src = ""; videoEl.style.display = "none"; }
        activeTokenId = null;
      }, 250);
    }
    return;
  }

  // Check if module is enabled
  if (!game.settings.get("simple-hover-art", "enabled")) return;

  // Check permissions
  const actor = token.actor;
  if (actor) {
    const permissionReq = game.settings.get("simple-hover-art", "permissionRequirement");
    if (permissionReq === "observer" && !actor.testUserPermission(game.user, "OBSERVER")) return;
    if (permissionReq === "owner" && !actor.testUserPermission(game.user, "OWNER")) return;
  }

  // Check NPC visibility for non-GMs
  if (!game.user.isGM && !game.settings.get("simple-hover-art", "showNPCs")) {
    const isNPC = !actor || !actor.hasPlayerOwner;
    if (isNPC) return;
  }

  // Determine which image to display.
  //
  // A token-specific image stored by macros or other modules has priority.
  let imgPath = token.document.getFlag(
    "simple-hover-art",
    "specificArt"
  ) || null;

  if (!imgPath) {
    const artType = game.settings.get("simple-hover-art", "artType");

    if (artType === "character" && actor) {
      imgPath = actor.img;

      // Fall back to token image if character image is the default mystery man
      if (
        imgPath === "icons/svg/mystery-man.svg"
        && token.document.texture.src
      ) {
        imgPath = token.document.texture.src;
      }
    } else {
      imgPath = token.document.texture.src;
    }
  }

  // Don't show if there's no valid image path or if it's the mystery man
  if (!imgPath || imgPath === "icons/svg/mystery-man.svg") return;

  // Determine hover delay: swap immediately if the card is already active, else apply configured delay
  const isAlreadyActive = container.classList.contains("active");
  const delay = isAlreadyActive ? 0 : game.settings.get("simple-hover-art", "hoverDelay");

  // Start show timer
  hoverTimer = setTimeout(() => {
    // Set size dynamically from settings
    const cardSize = game.settings.get("simple-hover-art", "cardSize");
    container.style.width = `${cardSize}px`;
    container.style.height = `${cardSize}px`;

    // Set position class dynamically from settings
    const position = game.settings.get("simple-hover-art", "imagePosition") || "bottom-left";
    container.classList.remove("pos-bottom-left", "pos-bottom-right", "pos-top-left", "pos-top-right");
    container.classList.add(`pos-${position}`);

    // Detect if media is video or image
    const videoExtensions = ["mp4", "webm", "ogg", "m4v"];
    const ext = imgPath.split(".").pop().toLowerCase().split("?")[0];
    const isVideo = videoExtensions.includes(ext);

    const imgEl = container.querySelector("img");
    const videoEl = container.querySelector("video");
    const captionEl = container.querySelector(".hover-art-caption");

    if (isVideo) {
      if (imgEl) { imgEl.src = ""; imgEl.style.display = "none"; }
      if (videoEl) {
        videoEl.src = imgPath;
        videoEl.style.display = "block";
        videoEl.play().catch(err => console.debug("SimpleHoverArt | Video play failed:", err));
      }
    } else {
      if (videoEl) { videoEl.src = ""; videoEl.style.display = "none"; }
      if (imgEl) {
        imgEl.src = imgPath;
        imgEl.style.display = "block";
      }
    }

    // Set caption name label
    const showName = game.settings.get("simple-hover-art", "showName");
    if (showName) {
      captionEl.textContent = token.name;
      captionEl.style.display = "block";
    } else {
      captionEl.style.display = "none";
    }

    // Activate container
    container.classList.add("active");
    activeTokenId = token.id;
  }, delay);
});
