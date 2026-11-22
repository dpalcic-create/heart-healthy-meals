/* Heart-Healthy Meals — client app. Recipe data is injected as window.RECIPES. */
(function () {
  "use strict";

  const RECIPES = window.RECIPES;
  const BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
  const STORAGE_KEY = "hhm-v1";
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const DAY_LABELS = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  const DAY_SHORT = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
  const MEALS = ["breakfast", "lunch", "dinner", "snack", "dessert"];
  const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", dessert: "Dessert" };
  const SECTION_ORDER = ["meat", "produce", "nuts", "pantry", "drinks"];
  const SECTION_LABELS = {
    meat: "Meat & Seafood",
    produce: "Produce",
    nuts: "Nuts & Oils",
    pantry: "Pantry / Spices",
    drinks: "Drinks",
  };
  const PROTEIN_LABELS = {
    chicken: "Chicken",
    turkey: "Turkey",
    salmon: "Salmon",
    trout: "Trout",
    "white-fish": "White fish",
    shrimp: "Shrimp",
    shellfish: "Shellfish",
    beef: "Lean beef",
    bison: "Bison",
    pork: "Pork",
    "protein-powder": "Protein powder",
    nuts: "Nuts / nut butter",
  };
  const SEASONING_KEYS = new Set([
    "salt", "black-pepper", "cinnamon", "smoked-paprika", "paprika", "oregano", "thyme",
    "rosemary", "cumin", "turmeric", "garlic-powder", "onion-powder", "mustard-powder",
    "crushed-red-pepper", "dill", "chili-powder", "caraway", "nutmeg", "cayenne", "vanilla",
    "vinegar", "lemon", "lime", "water", "coffee", "tea",
  ]);
  const SPICE_RACK_KEYS = new Set([
    "salt", "black-pepper", "cinnamon", "smoked-paprika", "paprika", "oregano", "thyme",
    "rosemary", "cumin", "turmeric", "garlic-powder", "onion-powder", "mustard-powder",
    "crushed-red-pepper", "dill", "chili-powder", "caraway", "nutmeg", "cayenne",
  ]);
  const SKIP_SHOP = new Set(["water"]);
  const TARGETS = { proteinMin: 90, satFatWarn: 15, satFatHigh: 20, sodiumWarn: 1500, sodiumHigh: 2300 };
  const WATER_GOAL = 8;

  const PANTRY_CATALOG = [
    { group: "Proteins", items: [
      ["chicken-breast", "Chicken breast"],
      ["chicken-thigh", "Chicken thighs (skinless)"],
      ["turkey-breast", "Turkey breast"],
      ["ground-turkey", "Ground turkey"],
      ["salmon", "Salmon"],
      ["trout", "Rainbow trout"],
      ["cod", "Cod"],
      ["haddock", "Haddock"],
      ["shrimp", "Shrimp"],
      ["scallops", "Scallops"],
      ["lean-beef", "Lean beef"],
      ["bison", "Bison"],
      ["pork-tenderloin", "Pork tenderloin"],
      ["protein-powder", "Protein powder (Previnex or similar)"],
    ]},
    { group: "Vegetables", items: [
      ["brussels-sprouts", "Brussels sprouts"],
      ["broccoli", "Broccoli"],
      ["cauliflower", "Cauliflower"],
      ["spinach", "Spinach"],
      ["kale", "Kale"],
      ["leafy-greens", "Mixed leafy greens / lettuce"],
      ["asparagus", "Asparagus"],
      ["green-beans", "Green beans"],
      ["zucchini", "Zucchini"],
      ["cucumber", "Cucumber"],
      ["bell-pepper", "Bell peppers"],
      ["onion", "Onions"],
      ["garlic", "Garlic"],
      ["mushrooms", "Mushrooms"],
      ["cabbage", "Cabbage"],
    ]},
    { group: "Fats & extras", items: [
      ["olive-oil", "Olive oil"],
      ["avocado", "Avocado"],
      ["almonds", "Almonds"],
      ["walnuts", "Walnuts"],
      ["macadamia", "Macadamia nuts"],
      ["peanuts", "Peanuts"],
      ["almond-butter", "Natural almond butter"],
      ["peanut-butter", "Natural peanut butter"],
      ["cocoa", "Unsweetened cocoa powder"],
      ["fresh-herbs", "Fresh herbs"],
      ["ginger", "Fresh ginger"],
    ]},
  ];

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function emptyPlan() {
    const plan = {};
    DAYS.forEach((d) => {
      plan[d] = {};
      MEALS.forEach((m) => { plan[d][m] = null; });
    });
    return plan;
  }

  function defaultState() {
    return {
      favorites: [],
      plan: emptyPlan(),
      shopChecked: {},
      shopCustom: [],
      pantry: {},
      haveSeasonings: true,
      water: {},
      welcomeDismissed: false,
    };
  }

  function loadState() {
    const base = defaultState();
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const merged = { ...base, ...raw };
      merged.plan = emptyPlan();
      if (raw.plan) {
        DAYS.forEach((d) => {
          MEALS.forEach((m) => {
            const slot = raw.plan[d] && raw.plan[d][m];
            if (slot && slot.id && BY_ID[slot.id]) merged.plan[d][m] = { id: slot.id, servings: slot.servings || 1 };
          });
        });
      }
      merged.favorites = (raw.favorites || []).filter((id) => BY_ID[id]);
      merged.shopCustom = Array.isArray(raw.shopCustom) ? raw.shopCustom : [];
      merged.shopChecked = raw.shopChecked && typeof raw.shopChecked === "object" ? raw.shopChecked : {};
      merged.pantry = raw.pantry && typeof raw.pantry === "object" ? raw.pantry : {};
      merged.water = raw.water && typeof raw.water === "object" ? raw.water : {};
      return merged;
    } catch (e) {
      return base;
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore quota */ }
  }

  let state = loadState();
  let ui = {
    view: "recipes",
    category: "all",
    query: "",
    protein: "",
    time: "",
    tag: "",
    favOnly: false,
    detailId: null,
    detailServings: 1,
    picker: null,
    cook: null,
    cookStep: 0,
    wakeLock: null,
    matchMode: "now",
    drag: null,
  };

  function totalTime(r) { return (r.prep || 0) + (r.cook || 0); }

  function formatTime(r) {
    const t = totalTime(r);
    if (r.cook && r.prep) return `${t} min (${r.prep} prep + ${r.cook} cook)`;
    if (r.cook) return `${t} min`;
    return `${t} min · no cook`;
  }

  function toFrac(n) {
    if (n == null || Number.isNaN(n)) return "";
    const sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    const whole = Math.floor(n + 1e-9);
    const rem = n - whole;
    const table = [
      [0, ""], [1 / 8, "⅛"], [1 / 6, "⅙"], [1 / 5, "⅕"], [1 / 4, "¼"], [1 / 3, "⅓"],
      [3 / 8, "⅜"], [2 / 5, "⅖"], [1 / 2, "½"], [3 / 5, "⅗"], [5 / 8, "⅝"], [2 / 3, "⅔"],
      [3 / 4, "¾"], [4 / 5, "⅘"], [5 / 6, "⅚"], [7 / 8, "⅞"],
    ];
    let best = "", bestDiff = 0.04;
    if (rem < 0.04) return sign + String(whole || "0").replace(/^0$/, "0");
    if (1 - rem < 0.04) return sign + String(whole + 1);
    table.forEach(([v, s]) => {
      const d = Math.abs(rem - v);
      if (d < bestDiff) { bestDiff = d; best = s; }
    });
    if (!best) {
      const rounded = Math.round(n * 100) / 100;
      return sign + String(rounded);
    }
    return sign + (whole ? whole + best : best);
  }

  function pluralUnit(qty, unit) {
    if (!unit) return "";
    const u = unit;
    const plural = qty > 1.04;
    if (!plural) {
      if (u === "cups") return "cup";
      if (u === "cloves") return "clove";
      if (u === "leaves") return "leaf";
      if (u === "scoops") return "scoop";
      if (u === "pinches") return "pinch";
      return u;
    }
    if (u === "cup") return "cups";
    if (u === "clove") return "cloves";
    if (u === "leaf") return "leaves";
    if (u === "scoop") return "scoops";
    if (u === "pinch") return "pinches";
    return u;
  }

  function formatQty(qty, unit) {
    const q = toFrac(qty);
    const u = pluralUnit(qty, unit);
    return u ? `${q} ${u}` : q;
  }

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function todayDow() {
    return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function isFav(id) { return state.favorites.includes(id); }

  function toggleFav(id, ev) {
    if (ev) ev.stopPropagation();
    if (isFav(id)) state.favorites = state.favorites.filter((x) => x !== id);
    else state.favorites.push(id);
    saveState();
    render();
  }

  function scaledNutrition(r, servings) {
    const f = servings / r.servings;
    return {
      cal: Math.round(r.nutrition.cal * f),
      protein: Math.round(r.nutrition.protein * f),
      satFat: Math.round(r.nutrition.satFat * f * 10) / 10,
      sodium: Math.round(r.nutrition.sodium * f),
    };
  }

  function dayTotals(day) {
    const t = { cal: 0, protein: 0, satFat: 0, sodium: 0, count: 0 };
    MEALS.forEach((m) => {
      const slot = state.plan[day][m];
      if (!slot || !BY_ID[slot.id]) return;
      const n = scaledNutrition(BY_ID[slot.id], slot.servings);
      t.cal += n.cal; t.protein += n.protein; t.satFat += n.satFat; t.sodium += n.sodium; t.count++;
    });
    t.satFat = Math.round(t.satFat * 10) / 10;
    return t;
  }

  function toneSat(v) { return v > TARGETS.satFatHigh ? "alert" : v > TARGETS.satFatWarn ? "warn" : "ok"; }
  function toneNa(v) { return v > TARGETS.sodiumHigh ? "alert" : v > TARGETS.sodiumWarn ? "warn" : "ok"; }
  function tonePro(v) { return v >= TARGETS.proteinMin ? "ok" : "warn"; }

  function filteredRecipes() {
    const q = ui.query.trim().toLowerCase();
    return RECIPES.filter((r) => {
      if (ui.category !== "all" && r.category !== ui.category) return false;
      if (ui.favOnly && !isFav(r.id)) return false;
      if (ui.protein && r.protein !== ui.protein) return false;
      if (ui.time && totalTime(r) > Number(ui.time)) return false;
      if (ui.tag && !r.tags.includes(ui.tag)) return false;
      if (q) {
        const blob = [r.name, r.category, r.protein, r.leftovers, r.dessertNote, ...(r.tags || []), ...(r.steps || []), ...r.ingredients.map((i) => i.name)].join(" ").toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }

  function setSlot(day, meal, recipeId, servings) {
    if (!recipeId) state.plan[day][meal] = null;
    else {
      const r = BY_ID[recipeId];
      state.plan[day][meal] = { id: recipeId, servings: servings || 1 };
    }
    saveState();
  }

  function autoFillWeek() {
    const used = new Set();
    const plan = emptyPlan();
    const fatty = (r) => r.protein === "salmon" || r.protein === "trout";
    const red = (r) => r.protein === "beef" || r.protein === "bison";

    function pick(cat, pred) {
      let pool = RECIPES.filter((r) => r.category === cat && !used.has(r.id) && (!pred || pred(r)));
      if (!pool.length) pool = RECIPES.filter((r) => r.category === cat && !used.has(r.id));
      if (!pool.length) pool = RECIPES.filter((r) => r.category === cat);
      if (!pool.length) return null;
      const r = pool[Math.floor(Math.random() * pool.length)];
      used.add(r.id);
      return r;
    }

    const fishDays = shuffle(DAYS).slice(0, 3);
    const leftoverDays = DAYS.filter((d) => !fishDays.includes(d));
    const redCount = Math.random() < 0.55 ? 2 : 1;
    const redDays = shuffle(leftoverDays).slice(0, redCount);
    const shakeDays = new Set(shuffle(DAYS).slice(0, 2));
    const dessertDays = new Set(shuffle(DAYS).slice(0, 2));
    const prevDinner = { protein: null };

    DAYS.forEach((day) => {
      const bPred = shakeDays.has(day)
        ? (r) => r.protein === "protein-powder"
        : (r) => r.protein !== "protein-powder";
      const breakfast = pick("breakfast", bPred);

      let lunchPred = (r) => !red(r) && !fatty(r);
      let dinnerPred = (r) => !red(r) && !fatty(r) && r.protein !== prevDinner.protein;

      if (fishDays.includes(day)) {
        dinnerPred = (r) => fatty(r);
        lunchPred = (r) => !red(r) && !fatty(r);
      } else if (redDays.includes(day)) {
        dinnerPred = (r) => red(r);
        lunchPred = (r) => !red(r) && !fatty(r);
      }

      let dinner = pick("dinner", dinnerPred);
      let lunch = pick("lunch", lunchPred);

      if (lunch && dinner && lunch.protein === dinner.protein) {
        const alt = pick("lunch", (r) => r.protein !== dinner.protein && !red(r));
        if (alt) lunch = alt;
      }

      const snack = pick("snack");
      const dessert = dessertDays.has(day) ? pick("dessert") : null;

      const put = (meal, rec) => {
        if (rec) plan[day][meal] = { id: rec.id, servings: 1 };
      };
      put("breakfast", breakfast);
      put("lunch", lunch);
      put("dinner", dinner);
      put("snack", snack);
      put("dessert", dessert);
      prevDinner.protein = dinner ? dinner.protein : null;
    });

    state.plan = plan;
    state.shopChecked = {};
    saveState();
  }

  function tspOf(ing, scale) {
    const q = ing.qty * scale;
    const u = (ing.unit || "").toLowerCase();
    if (u === "tsp") return q;
    if (u === "tbsp") return q * 3;
    if (u === "cup" || u === "cups") return q * 48;
    return null;
  }

  function shoppingList() {
    const buy = new Map();
    const spices = new Set();
    function add(key, name, qty, unit, section) {
      const k = key + "|" + (unit || "") + "|" + section;
      const cur = buy.get(k);
      if (cur) cur.qty += qty;
      else buy.set(k, { key, name, qty, unit: unit || "", section });
    }

    DAYS.forEach((d) => {
      MEALS.forEach((m) => {
        const slot = state.plan[d][m];
        if (!slot || !BY_ID[slot.id]) return;
        const r = BY_ID[slot.id];
        const scale = slot.servings / r.servings;
        r.ingredients.forEach((ing) => {
          if (SKIP_SHOP.has(ing.key)) return;
          if (SPICE_RACK_KEYS.has(ing.key)) {
            spices.add(ing.name.replace(/,.*$/, "").replace(/\s*\(.*?\)\s*/g, "").trim());
            return;
          }
          add(ing.key, ing.name, ing.qty * scale, ing.unit, ing.section);
        });
      });
    });

    state.shopCustom.forEach((c) => {
      add("custom-" + c.id, c.name, c.qty || 1, c.unit || "", c.section || "pantry");
    });

    const groups = {};
    SECTION_ORDER.forEach((s) => { groups[s] = []; });
    buy.forEach((item) => {
      const sec = groups[item.section] ? item.section : "pantry";
      groups[sec].push(item);
    });
    SECTION_ORDER.forEach((s) => {
      groups[s].sort((a, b) => a.name.localeCompare(b.name));
    });
    return { groups, spices: [...spices].sort() };
  }

  function shopKey(item) {
    return item.key + "|" + item.unit + "|" + item.section + "|" + item.name;
  }

  function listMatches() {
    const have = new Set(Object.keys(state.pantry).filter((k) => state.pantry[k]));
    function missingKeys(r) {
      const miss = [];
      r.ingredients.forEach((ing) => {
        if (SKIP_SHOP.has(ing.key)) return;
        if (state.haveSeasonings && SEASONING_KEYS.has(ing.key)) return;
        if (!have.has(ing.key)) miss.push(ing.key);
      });
      return [...new Set(miss)];
    }
    const now = [];
    const almost = [];
    RECIPES.forEach((r) => {
      const miss = missingKeys(r);
      if (miss.length === 0) now.push(r);
      else if (miss.length === 1) almost.push({ r, miss });
    });
    return { now, almost };
  }

  /* ---------- render ---------- */
  function render() {
    document.querySelectorAll("nav.tabs button").forEach((b) => {
      b.setAttribute("aria-selected", b.dataset.view === ui.view ? "true" : "false");
    });
    document.querySelectorAll("main > .view").forEach((v) => {
      v.classList.toggle("on", v.id === "view-" + ui.view);
    });
    const welcome = document.getElementById("welcome");
    if (welcome) welcome.hidden = !!state.welcomeDismissed;

    if (ui.view === "recipes") renderRecipes();
    if (ui.view === "plan") renderPlan();
    if (ui.view === "shop") renderShop();
    if (ui.view === "hand") renderHand();
    renderDetail();
    renderCook();
    renderWater();
  }

  function nutLine(n) {
    return `<span>${n.cal} cal</span><span>${n.protein}g protein</span><span>${n.satFat}g sat fat</span><span>${n.sodium}mg sodium</span>`;
  }

  function tagHtml(r) {
    return r.tags.map((t) => `<span class="tag ${esc(t)}">${esc(t.replace(/-/g, " "))}</span>`).join("");
  }

  function cardHtml(r) {
    const heart = isFav(r.id) ? "♥" : "♡";
    return `<button type="button" class="card" data-open="${esc(r.id)}" draggable="true">
      <div class="top">
        <h3>${esc(r.name)}</h3>
        <button type="button" class="fav ${isFav(r.id) ? "on" : ""}" data-fav="${esc(r.id)}" aria-label="${isFav(r.id) ? "Remove from favorites" : "Add to favorites"}">${heart}</button>
      </div>
      <div class="meta"><span>${esc(MEAL_LABELS[r.category])}</span><span>${totalTime(r)} min</span><span>${esc(PROTEIN_LABELS[r.protein] || r.protein)}</span><span>${r.servings} serving${r.servings > 1 ? "s" : ""}</span></div>
      <div class="macros">${nutLine(r.nutrition)}</div>
      <div class="tags">${tagHtml(r)}</div>
    </button>`;
  }

  function renderRecipes() {
    const list = filteredRecipes();
    document.getElementById("recipe-count").textContent = `${list.length} recipe${list.length === 1 ? "" : "s"}`;
    document.querySelectorAll(".subtabs .chip").forEach((c) => c.classList.toggle("on", c.dataset.cat === ui.category));
    document.getElementById("filter-protein").value = ui.protein;
    document.getElementById("filter-time").value = ui.time;
    document.getElementById("filter-tag").value = ui.tag;
    document.getElementById("filter-fav").classList.toggle("on", ui.favOnly);
    document.getElementById("recipe-search").value = ui.query;
    const grid = document.getElementById("recipe-grid");
    grid.innerHTML = list.length ? list.map(cardHtml).join("") : `<p class="empty">No recipes match those filters. Clear a filter or try another search.</p>`;
  }

  function renderPlan() {
    const today = todayDow();
    const root = document.getElementById("week");
    root.innerHTML = DAYS.map((d) => {
      const t = dayTotals(d);
      const slots = MEALS.map((m) => {
        const slot = state.plan[d][m];
        const r = slot && BY_ID[slot.id];
        if (!r) {
          return `<div class="slot" data-day="${d}" data-meal="${m}">
            <div class="label">${esc(MEAL_LABELS[m])}</div>
            <button type="button" class="ghost-slot" data-pick="${d}:${m}">Add a recipe</button>
          </div>`;
        }
        return `<div class="slot filled" data-day="${d}" data-meal="${m}" draggable="true">
          <div class="row">
            <div>
              <div class="label">${esc(MEAL_LABELS[m])}</div>
              <div class="name">${esc(r.name)}</div>
              <div class="meta" style="margin-top:2px">${totalTime(r)} min · ${esc(formatQty(slot.servings, slot.servings === 1 ? "serving" : "servings"))}</div>
            </div>
            <div>
              <button type="button" class="tiny" data-open="${esc(r.id)}" title="Open">ⓘ</button>
              <button type="button" class="tiny" data-pick="${d}:${m}" title="Change">↔</button>
              <button type="button" class="tiny" data-clear="${d}:${m}" title="Remove">×</button>
            </div>
          </div>
        </div>`;
      }).join("");
      const totals = t.count ? `<div class="totals">
        ${t.cal} cal
        · protein <b class="${tonePro(t.protein)}">${t.protein}g</b>
        · sat fat <b class="${toneSat(t.satFat)}">${t.satFat}g</b>
        · sodium <b class="${toneNa(t.sodium)}">${t.sodium}mg</b>
      </div>` : `<div class="totals">No meals planned</div>`;
      return `<article class="day ${d === today ? "today" : ""}">
        <h3><span>${esc(DAY_SHORT[d])}${d === today ? " · today" : ""}</span></h3>
        ${slots}${totals}
      </article>`;
    }).join("");
  }

  function renderWater() {
    const key = todayKey();
    const n = state.water[key] || 0;
    const el = document.getElementById("water-track");
    if (!el) return;
    const drops = Array.from({ length: WATER_GOAL }, (_, i) =>
      `<button type="button" class="drop ${i < n ? "on" : ""}" data-water="${i + 1}" aria-label="${i + 1} of ${WATER_GOAL} glasses">${i < n ? "●" : "○"}</button>`
    ).join("");
    el.innerHTML = `<span>Water today</span>${drops}<span>${n}/${WATER_GOAL}</span>`;
  }

  function renderShop() {
    const { groups, spices } = shoppingList();
    const hasPlan = DAYS.some((d) => MEALS.some((m) => state.plan[d][m]));
    const box = document.getElementById("shop-list");
    if (!hasPlan && !state.shopCustom.length) {
      box.innerHTML = `<p class="empty">Plan a week first, and the shopping list will build itself from those recipes. You can also add items by hand below.</p>`;
      return;
    }
    let html = "";
    SECTION_ORDER.forEach((sec) => {
      const items = groups[sec] || [];
      if (!items.length) return;
      html += `<div class="section"><h3>${esc(SECTION_LABELS[sec])}</h3>`;
      items.forEach((item) => {
        const k = shopKey(item);
        const checked = !!state.shopChecked[k];
        const qty = item.key.startsWith("custom-") && !item.unit ? "" : formatQty(item.qty, item.unit);
        html += `<div class="shop-item ${checked ? "checked" : ""}">
          <input type="checkbox" id="s-${esc(k)}" data-shop="${esc(k)}" ${checked ? "checked" : ""}>
          <label for="s-${esc(k)}">${qty ? `<strong>${esc(qty)}</strong> ` : ""}${esc(item.name)}</label>
          ${item.key.startsWith("custom-") ? `<button type="button" class="tiny" data-del-custom="${esc(item.key.slice(7))}">×</button>` : ""}
        </div>`;
      });
      html += `</div>`;
    });
    if (spices.length) {
      const k = "spices|rack|pantry";
      const checked = !!state.shopChecked[k];
      html += `<div class="section"><h3>Spice rack</h3>
        <div class="shop-item ${checked ? "checked" : ""}">
          <input type="checkbox" id="s-${esc(k)}" data-shop="${esc(k)}" ${checked ? "checked" : ""}>
          <label for="s-${esc(k)}">Check that you have: ${esc(spices.join(", "))} <em>(salt, if you use it, stays in moderation)</em></label>
        </div></div>`;
    }
    box.innerHTML = html || `<p class="empty">Nothing to buy yet.</p>`;
  }

  function shopText() {
    const { groups, spices } = shoppingList();
    const lines = ["Heart-Healthy Meals — shopping list", ""];
    SECTION_ORDER.forEach((sec) => {
      const items = groups[sec] || [];
      if (!items.length) return;
      lines.push(SECTION_LABELS[sec].toUpperCase());
      items.forEach((item) => {
        const mark = state.shopChecked[shopKey(item)] ? "[x]" : "[ ]";
        const qty = item.key.startsWith("custom-") && !item.unit ? "" : formatQty(item.qty, item.unit) + " ";
        lines.push(`${mark} ${qty}${item.name}`);
      });
      lines.push("");
    });
    if (spices.length) {
      lines.push("SPICE RACK");
      lines.push(`${state.shopChecked["spices|rack|pantry"] ? "[x]" : "[ ]"} ${spices.join(", ")}`);
      lines.push("");
    }
    return lines.join("\n").trim();
  }

  function renderHand() {
    const cat = document.getElementById("pantry-groups");
    cat.innerHTML = PANTRY_CATALOG.map((g) => {
      const checks = g.items.map(([key, label]) => {
        const on = !!state.pantry[key];
        return `<label><input type="checkbox" data-pantry="${esc(key)}" ${on ? "checked" : ""}> ${esc(label)}</label>`;
      }).join("");
      return `<div class="group"><h3>${esc(g.group)}</h3><div class="checks">${checks}</div></div>`;
    }).join("");
    document.getElementById("have-seasonings").checked = !!state.haveSeasonings;
    const { now, almost } = listMatches();
    const grid = document.getElementById("match-grid");
    const head = document.getElementById("match-head");
    if (ui.matchMode === "almost") {
      head.textContent = `${almost.length} recipe${almost.length === 1 ? "" : "s"} missing just one ingredient`;
      grid.innerHTML = almost.length
        ? almost.map(({ r, miss }) => {
            const label = pantryLabel(miss[0]);
            return cardHtml(r).replace("</div>\n      <div class=\"tags\">", `</div><div class="meta">Missing: ${esc(label)}</div><div class="tags">`);
          }).join("")
        : `<p class="empty">No almost-matches. Tick a few more ingredients, or look at “I can make now.”</p>`;
      // simpler missing note prepended after the fact:
      grid.innerHTML = almost.length
        ? almost.map(({ r, miss }) => `<div>${cardHtml(r)}<p class="est" style="margin:4px 4px 12px">Missing: ${esc(pantryLabel(miss[0]))}</p></div>`).join("")
        : `<p class="empty">No almost-matches. Tick a few more ingredients, or look at “I can make now.”</p>`;
    } else {
      head.textContent = `${now.length} recipe${now.length === 1 ? "" : "s"} you can make now`;
      grid.innerHTML = now.length ? now.map(cardHtml).join("") : `<p class="empty">Tick the foods you have on hand. Recipes that only need those foods — plus basic seasonings, if you checked that box — will show up here.</p>`;
    }
    document.getElementById("match-now").classList.toggle("on", ui.matchMode === "now");
    document.getElementById("match-almost").classList.toggle("on", ui.matchMode === "almost");
  }

  function pantryLabel(key) {
    for (const g of PANTRY_CATALOG) {
      const hit = g.items.find(([k]) => k === key);
      if (hit) return hit[1];
    }
    return key;
  }

  function renderDetail() {
    const overlay = document.getElementById("detail");
    const r = ui.detailId && BY_ID[ui.detailId];
    if (!r) { overlay.classList.remove("on"); overlay.setAttribute("aria-hidden", "true"); return; }
    overlay.classList.add("on");
    overlay.setAttribute("aria-hidden", "false");
    const serv = ui.detailServings;
    const n = scaledNutrition(r, serv);
    const scale = serv / r.servings;
    const ings = r.ingredients.map((i) =>
      `<li><span class="qty">${esc(formatQty(i.qty * scale, i.unit))}</span><span>${esc(i.name)}</span></li>`
    ).join("");
    const steps = r.steps.map((s) => `<li>${esc(s)}</li>`).join("");
    const dessert = r.dessertNote ? `<div class="callout warn">${esc(r.dessertNote)}</div>` : "";
    document.getElementById("detail-body").innerHTML = `
      <header class="mh">
        <div>
          <div class="meta">${esc(MEAL_LABELS[r.category])} · ${esc(formatTime(r))} · ${esc(PROTEIN_LABELS[r.protein] || r.protein)}</div>
          <h2>${esc(r.name)}</h2>
        </div>
        <button type="button" class="icon-btn" data-close-detail aria-label="Close">×</button>
      </header>
      <div class="tags">${tagHtml(r)}</div>
      ${dessert}
      <div class="actions">
        <div class="servings">
          <button type="button" data-serv="-1" aria-label="Fewer servings">−</button>
          <span>${esc(formatQty(serv, serv === 1 ? "serving" : "servings"))}</span>
          <button type="button" data-serv="1" aria-label="More servings">+</button>
        </div>
        <button type="button" class="btn secondary fav ${isFav(r.id) ? "on" : ""}" data-fav="${esc(r.id)}">${isFav(r.id) ? "♥ Favorited" : "♡ Favorite"}</button>
        <button type="button" class="btn secondary" data-add-plan="${esc(r.id)}">Add to plan</button>
        <button type="button" class="btn" data-cook="${esc(r.id)}">Cook mode</button>
      </div>
      <div class="macros">${nutLine(n)}</div>
      <p class="est">Nutrition is an estimate per the servings shown, not a lab analysis. Sodium assumes modest added salt.</p>
      <h3>Ingredients</h3>
      <ul class="ingredients">${ings}</ul>
      <h3>Steps</h3>
      <ol class="steps">${steps}</ol>
      <div class="note"><strong>Leftovers.</strong> ${esc(r.leftovers)}</div>
    `;
  }

  function renderCook() {
    const el = document.getElementById("cook");
    const rec = ui.cook && BY_ID[ui.cook.id];
    if (!rec) {
      el.classList.remove("on");
      releaseWake();
      return;
    }
    el.classList.add("on");
    const step = rec.steps[ui.cookStep] || "";
    const n = rec.steps.length;
    document.getElementById("cook-title").textContent = rec.name;
    document.getElementById("cook-progress").textContent = `Step ${ui.cookStep + 1} of ${n} · ${formatQty(ui.cook.servings, ui.cook.servings === 1 ? "serving" : "servings")}`;
    document.getElementById("cook-step").textContent = step;
    document.getElementById("cook-prev").disabled = ui.cookStep <= 0;
    document.getElementById("cook-next").textContent = ui.cookStep >= n - 1 ? "Done" : "Next";
    const wake = document.getElementById("cook-wake");
    wake.textContent = ui.wakeLock ? "Screen will stay on while this is open." : ("wakeLock" in navigator ? "Couldn't keep the screen on — check your browser settings." : "This browser can't keep the screen awake; lock-screen timeout still applies.");
  }

  async function requestWake() {
    releaseWake();
    try {
      if ("wakeLock" in navigator) {
        ui.wakeLock = await navigator.wakeLock.request("screen");
        ui.wakeLock.addEventListener("release", () => { ui.wakeLock = null; renderCook(); });
      }
    } catch (e) { ui.wakeLock = null; }
  }
  function releaseWake() {
    if (ui.wakeLock) {
      try { ui.wakeLock.release(); } catch (e) {}
      ui.wakeLock = null;
    }
  }

  function openDetail(id, servings) {
    const r = BY_ID[id];
    if (!r) return;
    ui.detailId = id;
    ui.detailServings = servings || r.servings;
    render();
  }

  function closeDetail() {
    ui.detailId = null;
    render();
  }

  function openCook(id, servings) {
    const r = BY_ID[id];
    if (!r) return;
    ui.cook = { id, servings: servings || ui.detailServings || r.servings };
    ui.cookStep = 0;
    requestWake();
    render();
  }

  function openPicker(day, meal) {
    ui.picker = { day, meal, q: "" };
    const r = document.getElementById("picker");
    r.classList.add("on");
    r.setAttribute("aria-hidden", "false");
    document.getElementById("picker-title").textContent = `Choose ${MEAL_LABELS[meal]} · ${DAY_LABELS[day]}`;
    document.getElementById("picker-search").value = "";
    renderPicker();
    setTimeout(() => document.getElementById("picker-search").focus(), 50);
  }

  function closePicker() {
    ui.picker = null;
    const r = document.getElementById("picker");
    r.classList.remove("on");
    r.setAttribute("aria-hidden", "true");
  }

  function renderPicker() {
    if (!ui.picker) return;
    const q = (ui.picker.q || "").toLowerCase();
    const list = RECIPES.filter((r) => r.category === ui.picker.meal && (!q || r.name.toLowerCase().includes(q) || r.tags.join(" ").includes(q) || r.protein.includes(q)));
    document.getElementById("picker-list").innerHTML = list.length
      ? list.map((r) => `<button type="button" class="card" data-assign="${esc(r.id)}">
          <h3>${esc(r.name)}</h3>
          <div class="meta">${totalTime(r)} min · ${esc(PROTEIN_LABELS[r.protein] || r.protein)}</div>
          <div class="macros">${nutLine(r.nutrition)}</div>
        </button>`).join("")
      : `<p class="empty">No matching ${ui.picker.meal} recipes.</p>`;
  }

  function setView(view) {
    ui.view = view;
    if (view !== "recipes") closeDetail();
    closePicker();
    window.scrollTo(0, 0);
    render();
  }

  /* ---------- events ---------- */
  function onClick(ev) {
    if (ev.target.id === "detail") { closeDetail(); return; }
    if (ev.target.id === "picker") { closePicker(); return; }
    const t = ev.target.closest("[data-view], [data-cat], [data-open], [data-fav], [data-pick], [data-clear], [data-close-detail], [data-serv], [data-add-plan], [data-cook], [data-assign], [data-del-custom], [data-water], [data-close-picker], #filter-fav, #auto-fill, #clear-plan, #copy-shop, #print-shop, #share-shop, #clear-checks, #add-custom, #dismiss-welcome, #match-now, #match-almost, #cook-prev, #cook-next, #cook-close");
    if (!t) return;

    if (t.dataset.view) { setView(t.dataset.view); return; }
    if (t.dataset.cat) { ui.category = t.dataset.cat; renderRecipes(); return; }
    if (t.id === "filter-fav") { ui.favOnly = !ui.favOnly; renderRecipes(); return; }
    if (t.dataset.open) { openDetail(t.dataset.open); return; }
    if (t.dataset.fav) { toggleFav(t.dataset.fav, ev); return; }
    if (t.dataset.pick) { const [d, m] = t.dataset.pick.split(":"); openPicker(d, m); return; }
    if (t.dataset.clear) {
      const [d, m] = t.dataset.clear.split(":");
      setSlot(d, m, null);
      render();
      return;
    }
    if (t.hasAttribute("data-close-detail")) { closeDetail(); return; }
    if (t.dataset.serv) {
      const r = BY_ID[ui.detailId];
      ui.detailServings = Math.max(1, Math.min(12, Math.round((ui.detailServings + Number(t.dataset.serv)) * 2) / 2 || 1));
      if (r && ui.detailServings < 1) ui.detailServings = 1;
      renderDetail();
      return;
    }
    if (t.dataset.addPlan) {
      const rec = BY_ID[t.dataset.addPlan];
      const meal = rec.category;
      const day = DAYS.find((d) => !state.plan[d][meal]) || todayDow();
      setSlot(day, meal, rec.id, ui.detailServings || 1);
      closeDetail();
      setView("plan");
      return;
    }
    if (t.dataset.cook) { openCook(t.dataset.cook, ui.detailServings); return; }
    if (t.dataset.assign) {
      setSlot(ui.picker.day, ui.picker.meal, t.dataset.assign, 1);
      closePicker();
      render();
      return;
    }
    if (t.hasAttribute("data-close-picker")) { closePicker(); return; }
    if (t.dataset.delCustom) {
      state.shopCustom = state.shopCustom.filter((c) => c.id !== t.dataset.delCustom);
      saveState();
      renderShop();
      return;
    }
    if (t.dataset.water) {
      const key = todayKey();
      const v = Number(t.dataset.water);
      const cur = state.water[key] || 0;
      state.water[key] = cur === v ? v - 1 : v;
      saveState();
      renderWater();
      return;
    }
    if (t.id === "auto-fill") {
      autoFillWeek();
      render();
      return;
    }
    if (t.id === "clear-plan") {
      state.plan = emptyPlan();
      state.shopChecked = {};
      saveState();
      render();
      return;
    }
    if (t.id === "copy-shop") {
      const text = shopText();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => flash("copy-shop", "Copied")).catch(() => fallbackCopy(text));
      } else fallbackCopy(text);
      return;
    }
    if (t.id === "print-shop") { window.print(); return; }
    if (t.id === "share-shop") {
      const text = shopText();
      if (navigator.share) navigator.share({ title: "Shopping list", text }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => flash("share-shop", "Copied"));
      return;
    }
    if (t.id === "clear-checks") { state.shopChecked = {}; saveState(); renderShop(); return; }
    if (t.id === "add-custom") {
      const name = document.getElementById("custom-name").value.trim();
      const section = document.getElementById("custom-section").value;
      if (!name) return;
      state.shopCustom.push({ id: String(Date.now()), name, section, qty: 1, unit: "" });
      document.getElementById("custom-name").value = "";
      saveState();
      renderShop();
      return;
    }
    if (t.id === "dismiss-welcome") { state.welcomeDismissed = true; saveState(); render(); return; }
    if (t.id === "match-now") { ui.matchMode = "now"; renderHand(); return; }
    if (t.id === "match-almost") { ui.matchMode = "almost"; renderHand(); return; }
    if (t.id === "cook-prev") { ui.cookStep = Math.max(0, ui.cookStep - 1); renderCook(); return; }
    if (t.id === "cook-next") {
      const rec = BY_ID[ui.cook.id];
      if (ui.cookStep >= rec.steps.length - 1) { ui.cook = null; releaseWake(); render(); }
      else { ui.cookStep += 1; renderCook(); }
      return;
    }
    if (t.id === "cook-close") { ui.cook = null; releaseWake(); render(); return; }
  }

  function flash(id, label) {
    const b = document.getElementById(id);
    if (!b) return;
    const old = b.textContent;
    b.textContent = label;
    setTimeout(() => { b.textContent = old; }, 1400);
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); flash("copy-shop", "Copied"); } catch (e) {}
    ta.remove();
  }

  function onChange(ev) {
    const t = ev.target;
    if (t.id === "recipe-search") { ui.query = t.value; renderRecipes(); return; }
    if (t.id === "filter-protein") { ui.protein = t.value; renderRecipes(); return; }
    if (t.id === "filter-time") { ui.time = t.value; renderRecipes(); return; }
    if (t.id === "filter-tag") { ui.tag = t.value; renderRecipes(); return; }
    if (t.id === "picker-search" && ui.picker) { ui.picker.q = t.value; renderPicker(); return; }
    if (t.id === "have-seasonings") { state.haveSeasonings = t.checked; saveState(); renderHand(); return; }
    if (t.dataset.shop) {
      state.shopChecked[t.dataset.shop] = t.checked;
      saveState();
      const row = t.closest(".shop-item");
      if (row) row.classList.toggle("checked", t.checked);
    }
    if (t.dataset.pantry) {
      state.pantry[t.dataset.pantry] = t.checked;
      saveState();
      renderHand();
    }
  }

  /* drag and drop */
  function onDragStart(ev) {
    const card = ev.target.closest(".card[data-open], .slot.filled");
    if (!card) return;
    if (card.dataset.open) {
      const r = BY_ID[card.dataset.open];
      ui.drag = { id: card.dataset.open, meal: r.category };
    } else if (card.dataset.day) {
      const slot = state.plan[card.dataset.day][card.dataset.meal];
      if (!slot) return;
      ui.drag = { id: slot.id, meal: card.dataset.meal, fromDay: card.dataset.day, fromMeal: card.dataset.meal, servings: slot.servings };
    } else return;
    ev.dataTransfer.setData("text/plain", ui.drag.id);
    ev.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(ev) {
    const slot = ev.target.closest(".slot");
    if (!slot || !ui.drag) return;
    if (ui.drag.meal && slot.dataset.meal !== ui.drag.meal) return;
    ev.preventDefault();
    slot.classList.add("dragover");
  }
  function onDragLeave(ev) {
    const slot = ev.target.closest(".slot");
    if (slot) slot.classList.remove("dragover");
  }
  function onDrop(ev) {
    const slot = ev.target.closest(".slot");
    document.querySelectorAll(".slot.dragover").forEach((s) => s.classList.remove("dragover"));
    if (!slot || !ui.drag) return;
    ev.preventDefault();
    const day = slot.dataset.day, meal = slot.dataset.meal;
    if (ui.drag.meal && meal !== ui.drag.meal) return;
    const existing = state.plan[day][meal];
    setSlot(day, meal, ui.drag.id, ui.drag.servings || 1);
    if (ui.drag.fromDay && (ui.drag.fromDay !== day || ui.drag.fromMeal !== meal)) {
      if (existing) setSlot(ui.drag.fromDay, ui.drag.fromMeal, existing.id, existing.servings);
      else setSlot(ui.drag.fromDay, ui.drag.fromMeal, null);
    }
    ui.drag = null;
    render();
  }

  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  document.addEventListener("input", (ev) => {
    if (ev.target.id === "recipe-search" || ev.target.id === "picker-search") onChange(ev);
  });
  document.addEventListener("dragstart", onDragStart);
  document.addEventListener("dragover", onDragOver);
  document.addEventListener("dragleave", onDragLeave);
  document.addEventListener("drop", onDrop);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      if (ui.cook) { ui.cook = null; releaseWake(); render(); }
      else if (ui.picker) closePicker();
      else if (ui.detailId) closeDetail();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && ui.cook) requestWake();
  });

  // Expose a few functions for a headless check in Node if needed
  window.HHM = { autoFillWeek, shoppingList, filteredRecipes, formatQty, toFrac, scaledNutrition, dayTotals, listMatches, loadState, state, RECIPES };

  render();
})();
