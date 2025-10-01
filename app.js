// app.js (type=module)
const SPOONACULAR_KEY = 'f362571a1f9e4079832588827a2c93ae'; // <-- put your key here
const SPOON_BASE = 'https://api.spoonacular.com';
const THEMEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';

const elements = {
  ingredientsInput: document.getElementById('ingredientsInput'),
  addIngredientBtn: document.getElementById('addIngredientBtn'),
  chips: document.getElementById('chips'),
  generateBtn: document.getElementById('generateBtn'),
  recipesGrid: document.getElementById('recipesGrid'),
  recipeTemplate: document.getElementById('recipeCardTemplate'),
  status: document.getElementById('status'),
  onlyExact: document.getElementById('onlyExact'),
  modal: document.getElementById('modal'),
  modalContent: document.getElementById('modalContent'),
  modalClose: document.getElementById('modalClose'),
  favoritesKey: 'rs_favorites'
};

let ingredients = [];
let favorites = loadFavorites();

document.getElementById('year').textContent = new Date().getFullYear();

// --- helpers ---
function parseInput(text){
  return text.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
}

function setStatus(msg){
  elements.status.textContent = msg || '';
}

function saveFavorites(){
  localStorage.setItem(elements.favoritesKey, JSON.stringify(favorites));
}

function loadFavorites(){
  try {
    return JSON.parse(localStorage.getItem('rs_favorites')||'[]');
  } catch(e){
    return [];
  }
}

function isFav(id){
  return favorites.includes(String(id));
}

// --- UI: chips ---
function renderChips(){
  elements.chips.innerHTML = '';
  ingredients.forEach((ing, idx) => {
    const el = document.createElement('span');
    el.className = 'chip';
    el.textContent = ing;
    const rem = document.createElement('button');
    rem.type = 'button';
    rem.title = 'Remove';
    rem.textContent = '✕';
    rem.style.marginLeft = '8px';
    rem.addEventListener('click', () => {
      ingredients.splice(idx,1);
      renderChips();
    });
    el.appendChild(rem);
    elements.chips.appendChild(el);
  });
}

// Add ingredient
elements.addIngredientBtn.addEventListener('click', () => {
  const text = elements.ingredientsInput.value.trim();
  if(!text) return;
  const parts = parseInput(text);
  for(const p of parts){
    if(!ingredients.includes(p)) ingredients.push(p);
  }
  elements.ingredientsInput.value = '';
  renderChips();
});

// Submit form
document.getElementById('searchForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const typed = elements.ingredientsInput.value.trim();
  if(typed) {
    parseInput(typed).forEach(p => { if(!ingredients.includes(p)) ingredients.push(p); });
    elements.ingredientsInput.value = '';
    renderChips();
  }
  if(ingredients.length === 0) {
    setStatus('Please add at least one ingredient.');
    return;
  }
  setStatus('Searching recipes…');
  await searchRecipes(ingredients, elements.onlyExact.checked);
});

// Search function
async function searchRecipes(ings, onlyExact=false){
  elements.recipesGrid.innerHTML = '';
  if(SPOONACULAR_KEY && SPOONACULAR_KEY !== 'YOUR_SPOONACULAR_API_KEY'){
    try {
      const q = encodeURIComponent(ings.join(','));
      const url = `${SPOON_BASE}/recipes/findByIngredients?ingredients=${q}&number=18&ranking=1&ignorePantry=true&apiKey=${SPOONACULAR_KEY}`;
      const resp = await fetch(url);
      if(!resp.ok) throw new Error(`API error ${resp.status}`);
      const data = await resp.json();
      if(Array.isArray(data) && data.length){
        renderRecipesFromSpoon(data, ings, onlyExact);
        setStatus(`Found ${data.length} recipes (Spoonacular).`);
        return;
      } else {
        setStatus('No recipes found from Spoonacular, trying fallback…');
      }
    } catch (err) {
      console.warn('Spoonacular failed', err);
      setStatus('Spoonacular API failed or key missing — using fallback.');
    }
  } else {
    setStatus('Spoonacular API key missing — using fallback.');
  }

  // fallback
  try {
    const first = encodeURIComponent(ings[0]);
    const resp = await fetch(`${THEMEALDB_BASE}/filter.php?i=${first}`);
    const body = await resp.json();
    if(body.meals){
      const mapped = body.meals.slice(0,18).map(m => ({
        id: m.idMeal,
        title: m.strMeal,
        image: m.strMealThumb,
        sourceUrl: `https://www.themealdb.com/meal.php?c=${m.idMeal}`
      }));
      renderRecipes(mapped);
      setStatus(`Showing ${mapped.length} recipes from TheMealDB (fallback).`);
      return;
    } else {
      setStatus('No results found.');
    }
  } catch(err){
    console.error(err);
    setStatus('All sources failed. Check console for details.');
  }
}

// Render functions
function renderRecipesFromSpoon(list, queryIngredients, onlyExact){
  const arr = list.map(r => ({
    id: r.id,
    title: r.title,
    image: r.image,
    usedCount: r.usedIngredientCount || 0,
    missedCount: r.missedIngredientCount || 0,
    missedIngredients: r.missedIngredients || [],
    usedIngredients: r.usedIngredients || []
  }));
  const filtered = onlyExact ? arr.filter(r => r.missedCount === 0) : arr;
  if(filtered.length === 0){
    setStatus('No exact matches — showing closest matches.');
    renderRecipes(arr);
  } else {
    renderRecipes(filtered);
  }
}

function renderRecipes(items){
  elements.recipesGrid.innerHTML = '';
  const tpl = elements.recipeTemplate;
  items.forEach(item => {
    const clone = tpl.content.cloneNode(true);
    const article = clone.querySelector('.recipe-card');
    const img = clone.querySelector('.recipe-img');
    const title = clone.querySelector('.recipe-title');
    const meta = clone.querySelector('.recipe-meta');
    const viewBtn = clone.querySelector('.view-btn');
    const favBtn = clone.querySelector('.fav-btn');

    img.src = item.image || '';
    img.alt = item.title || 'Recipe';
    title.textContent = item.title || 'Untitled';
    const metaText = item.missedCount !== undefined
      ? `${item.usedCount || 0} used • ${item.missedCount || 0} missing`
      : '';
    meta.textContent = metaText;

    viewBtn.addEventListener('click', () => showDetails(item));
    favBtn.addEventListener('click', () => {
      const id = String(item.id);
      if (isFav(id)) {
        favorites = favorites.filter(f => f !== id);
        favBtn.innerHTML = `<img src="assets/heart.svg" alt="Add to favorites">`;
        favBtn.setAttribute('aria-pressed','false');
      } else {
        favorites.push(id);
        favBtn.innerHTML = `<img src="assets/heart-filled.svg" alt="Remove from favorites">`;
        favBtn.setAttribute('aria-pressed','true');
      }
      saveFavorites();
    });

    if (isFav(String(item.id))) {
      favBtn.innerHTML = `<img src="assets/heart-filled.svg" alt="Remove from favorites">`;
      favBtn.setAttribute('aria-pressed','true');
    } else {
      favBtn.innerHTML = `<img src="assets/heart.svg" alt="Add to favorites">`;
    }

    elements.recipesGrid.appendChild(clone);
  });
}

// Show recipe details
async function showDetails(item){
  elements.modal.setAttribute('aria-hidden','false');
  elements.modalContent.innerHTML = `<p>Loading details…</p>`;
  if(SPOONACULAR_KEY && SPOONACULAR_KEY !== 'YOUR_SPOONACULAR_API_KEY' && item.id && Number(item.id)){
    try {
      const url = `${SPOON_BASE}/recipes/${item.id}/information?includeNutrition=true&apiKey=${SPOONACULAR_KEY}`;
      const resp = await fetch(url);
      const detail = await resp.json();
      renderDetailModal(detail);
      return;
    } catch(err){
      console.warn('Spoon detail failed', err);
    }
  }
  try {
    const resp = await fetch(`${THEMEALDB_BASE}/lookup.php?i=${item.id}`);
    const body = await resp.json();
    if(body.meals && body.meals[0]){
      renderDetailModal(body.meals[0], true);
      return;
    }
  } catch(err){ console.warn(err); }
  elements.modalContent.innerHTML = `<p>Details not available.</p>`;
}

function renderDetailModal(detail, isMealDB=false){
  let html = `<h2>${detail.title || detail.strMeal || 'Recipe'}</h2>`;
  if(detail.image || detail.strMealThumb) {
    html += `<img src="${detail.image || detail.strMealThumb}" alt="" style="max-width:220px;border-radius:8px;display:block;margin:10px 0">`;
  }
  if(isMealDB){
    html += `<h3>Category: ${detail.strCategory || ''}</h3>`;
    html += `<h4>Ingredients</h4><ul>`;
    for(let i=1;i<=20;i++){
      const ing = detail[`strIngredient${i}`];
      const measure = detail[`strMeasure${i}`];
      if(ing && ing.trim()) html += `<li>${ing} — ${measure || ''}</li>`;
    }
    html += `</ul>`;
    if(detail.strInstructions) html += `<h4>Instructions</h4><p>${detail.strInstructions}</p>`;
  } else {
    html += `<h4>Ready in ${detail.readyInMinutes || '-'} mins • Servings: ${detail.servings || '-'}</h4>`;
    if(detail.extendedIngredients){
      html += `<h4>Ingredients</h4><ul>`;
      detail.extendedIngredients.forEach(ing => {
        html += `<li>${ing.original}</li>`;
      });
      html += `</ul>`;
    }
    if(detail.instructions){
      html += `<h4>Instructions</h4><div>${detail.instructions}</div>`;
    }
    if(detail.nutrition && detail.nutrition.nutrients){
      html += `<h4>Nutrition (per recipe)</h4><ul>`;
      detail.nutrition.nutrients.slice(0,6).forEach(n => {
        html += `<li>${n.title}: ${n.amount}${n.unit}</li>`;
      });
      html += `</ul>`;
    }
    if(detail.sourceUrl) {
      html += `<p><a href="${detail.sourceUrl}" target="_blank" rel="noopener">View original recipe</a></p>`;
    }
  }
  elements.modalContent.innerHTML = html;
}

// Modal close
elements.modalClose.addEventListener('click', () => {
  elements.modal.setAttribute('aria-hidden','true');
});
elements.modal.addEventListener('click', (ev) => {
  if(ev.target === elements.modal) elements.modal.setAttribute('aria-hidden','true');
});

// FAQ accordion
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    const a = btn.nextElementSibling;
    if(a) a.hidden = expanded;
  });
});

// Init
renderChips();
setStatus('');