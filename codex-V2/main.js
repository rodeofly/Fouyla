// main.js
// Librairie voxel : noa-engine (CDN https://unpkg.com/noa-engine@0.8.8/build/noa.js)
// Choix : moteur voxel web complet (chunks, rayon de sélection, physique, contrôle FPS) léger sans build.
// Inclusion : script CDN dans index.html + SimplexNoise en CDN pour la génération procédurale.

(function() {
  const canvas = document.getElementById('game-canvas');
  const hud = document.getElementById('hud');
  const title = document.getElementById('title-screen');
  const tutorialBox = document.getElementById('tutorial');
  const hotbarEl = document.getElementById('hotbar');
  const selectedName = document.getElementById('selected-name');
  const inventoryOverlay = document.getElementById('inventory');
  const inventoryGrid = document.getElementById('inventory-grid');
  const recipesEl = document.getElementById('recipes');
  const craftResult = document.getElementById('craft-result');
  const toast = document.getElementById('toast');
  const photoPanel = document.getElementById('photo-panel');
  const teleportPanel = document.getElementById('teleport-panel');

    // --- Moteur voxel ---
    const noaFactory = window.noa || (window.NOA && window.NOA.Engine);
    if (!noaFactory) {
      throw new Error('noa-engine non chargé (vérifie le script CDN)');
    }
    const noa = typeof noaFactory === 'function' ? new noaFactory({
      debug: false,
      inverseY: false,
      showFPS: false,
      chunkSize: 32,
      chunkAddDistance: 3,
      chunkRemoveDistance: 4,
      playerStart: [0, 60, 0],
      playerWidth: 0.6,
      playerHeight: 1.8,
      renderOnResize: true,
      useAO: true,
      blockTestDistance: 8,
      canvas: canvas
    }) : noaFactory({
      debug: false,
      inverseY: false,
      showFPS: false,
      chunkSize: 32,
      chunkAddDistance: 3,
      chunkRemoveDistance: 4,
      playerStart: [0, 60, 0],
      playerWidth: 0.6,
      playerHeight: 1.8,
      renderOnResize: true,
      useAO: true,
      blockTestDistance: 8,
      canvas: canvas
    });

  // Lumière et ambiance "wow"
  const scene = noa.rendering.getScene();
  scene.clearColor = new BABYLON.Color3(0.04, 0.06, 0.1);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
  scene.fogDensity = 0.005;
  scene.fogColor = new BABYLON.Color3(0.1, 0.15, 0.22);
  const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.4, -1, 0.3), scene);
  sun.intensity = 1.2;
  const ambient = new BABYLON.HemisphericLight('ambient', new BABYLON.Vector3(0, 1, 0), scene);
  ambient.intensity = 0.5;

  // --- Blocs ---
  const materials = {
    grass: noa.registry.registerMaterial('grass', null, null, false, { color: [0.35, 0.8, 0.38] }),
    dirt: noa.registry.registerMaterial('dirt', null, null, false, { color: [0.5, 0.35, 0.2] }),
    stone: noa.registry.registerMaterial('stone', null, null, false, { color: [0.5, 0.52, 0.55] }),
    wood: noa.registry.registerMaterial('wood', null, null, false, { color: [0.4, 0.28, 0.18] }),
    plank: noa.registry.registerMaterial('plank', null, null, false, { color: [0.76, 0.6, 0.38] }),
    torch: noa.registry.registerMaterial('torch', null, null, false, { color: [1, 0.82, 0.4], renderMaterial: 'transparent' }),
  };

  const BLOCKS = {
    air: 0,
    grass: noa.registry.registerBlock(1, { material: materials.grass }),
    dirt: noa.registry.registerBlock(2, { material: materials.dirt }),
    stone: noa.registry.registerBlock(3, { material: materials.stone }),
    wood: noa.registry.registerBlock(4, { material: materials.wood }),
    plank: noa.registry.registerBlock(5, { material: materials.plank }),
    torch: noa.registry.registerBlock(6, { material: materials.torch, opaque: false, light: 7 })
  };

  const blockNames = {
    [BLOCKS.grass]: 'Herbe',
    [BLOCKS.dirt]: 'Terre',
    [BLOCKS.stone]: 'Pierre',
    [BLOCKS.wood]: 'Bois',
    [BLOCKS.plank]: 'Planches',
    [BLOCKS.torch]: 'Torche'
  };

  // --- Génération procédurale ---
  const simplex = new SimplexNoise('codex-v2');
  const worldHeight = 64;
  const waterLevel = 20;
  const lakeRadius = 18;
  const hillPosition = [40, 0, 40];
  const lakeCenter = [-30, 0, 20];

  noa.world.on('worldDataNeeded', (id, data, x, y, z) => {
    const size = noa.world.chunkSize;
    for (let i = 0; i < size; i++) {
      for (let k = 0; k < size; k++) {
        const wx = x + i;
        const wz = z + k;
        const n = simplex.noise2D(wx / 60, wz / 60);
        const h = Math.floor(20 + n * 10 + simplex.noise2D(wx / 18, wz / 18) * 4);
        for (let j = 0; j < size; j++) {
          const wy = y + j;
          if (wy > h) continue;
          let block = BLOCKS.stone;
          if (wy === h) block = BLOCKS.grass;
          else if (wy > h - 3) block = BLOCKS.dirt;
          if (wy < 12) block = BLOCKS.stone;
          // Ressource bois par zones circulaires
          const dx = wx - 10;
          const dz = wz + 5;
          if (wy === h && Math.sqrt(dx * dx + dz * dz) < 12 && Math.random() < 0.15) {
            block = BLOCKS.wood;
          }
          // Lac peu profond
          const lx = wx - lakeCenter[0];
          const lz = wz - lakeCenter[2];
          if (Math.sqrt(lx * lx + lz * lz) < lakeRadius && wy <= waterLevel) {
            block = wy === waterLevel ? BLOCKS.dirt : BLOCKS.stone;
          }
          const index = i + size * (j + size * k);
          data[index] = block;
        }
      }
    }
    noa.world.worldDataFilled(id, data);
  });

  // --- Inventaire & hotbar ---
  const inventory = { [BLOCKS.grass]: 0, [BLOCKS.dirt]: 0, [BLOCKS.stone]: 0, [BLOCKS.wood]: 2, [BLOCKS.plank]: 0, [BLOCKS.torch]: 0 };
  const hotbarSlots = [BLOCKS.grass, BLOCKS.dirt, BLOCKS.stone, BLOCKS.wood, BLOCKS.plank, BLOCKS.torch];
  let hotIndex = 0;

  function updateHotbar() {
    hotbarEl.innerHTML = '';
    hotbarSlots.forEach((id, idx) => {
      const slot = document.createElement('div');
      slot.className = 'hot-slot' + (idx === hotIndex ? ' active' : '');
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = blockNames[id] || 'Vide';
      const qty = document.createElement('div');
      qty.className = 'qty';
      qty.textContent = inventory[id] || 0;
      slot.appendChild(name);
      slot.appendChild(qty);
      hotbarEl.appendChild(slot);
    });
    selectedName.textContent = `${blockNames[hotbarSlots[hotIndex]]} x${inventory[hotbarSlots[hotIndex]] || 0}`;
  }

  function updateInventoryGrid() {
    inventoryGrid.innerHTML = '';
    Object.keys(inventory).forEach(id => {
      const slot = document.createElement('div');
      slot.className = 'inventory-slot';
      slot.innerHTML = `<div class="item-name">${blockNames[id]}</div><div class="item-qty">${inventory[id]} en stock</div>`;
      inventoryGrid.appendChild(slot);
    });
  }

  // --- Craft ---
  const recipes = [
    { id: 'plank', title: 'Planches (x4)', input: { [BLOCKS.wood]: 1 }, output: { [BLOCKS.plank]: 4 }, description: '1 Bois → 4 Planches' },
    { id: 'torch', title: 'Torches (x4)', input: { [BLOCKS.plank]: 1, [BLOCKS.stone]: 1 }, output: { [BLOCKS.torch]: 4 }, description: '1 Pierre + 1 Planche → 4 Torches lumineuses' }
  ];
  let selectedRecipe = null;

  function renderRecipes() {
    recipesEl.innerHTML = '';
    recipes.forEach(r => {
      const card = document.createElement('div');
      card.className = 'recipe-card';
      card.innerHTML = `<div class="recipe-title">${r.title}</div><div class="recipe-ingredients">${Object.keys(r.input).map(id => `${r.input[id]}× ${blockNames[id]}`).join(' + ')}</div><div class="recipe-ingredients">Résultat : ${Object.keys(r.output).map(id => `${r.output[id]}× ${blockNames[id]}`).join(', ')}</div>`;
      card.onclick = () => selectRecipe(r);
      recipesEl.appendChild(card);
    });
  }

  function selectRecipe(recipe) {
    selectedRecipe = recipe;
    craftResult.innerHTML = `<div>${recipe.title}</div><div class="recipe-ingredients">${Object.keys(recipe.input).map(id => `${recipe.input[id]}× ${blockNames[id]}`).join(' + ')} → ${Object.keys(recipe.output).map(id => `${recipe.output[id]}× ${blockNames[id]}`).join(', ')}</div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Fabriquer';
    btn.onclick = craftSelected;
    craftResult.appendChild(btn);
  }

  function hasResources(req) {
    return Object.keys(req).every(id => (inventory[id] || 0) >= req[id]);
  }

  function craftSelected() {
    if (!selectedRecipe) return;
    if (!hasResources(selectedRecipe.input)) {
      showToast('Ressources insuffisantes');
      return;
    }
    Object.keys(selectedRecipe.input).forEach(id => inventory[id] -= selectedRecipe.input[id]);
    Object.keys(selectedRecipe.output).forEach(id => inventory[id] = (inventory[id] || 0) + selectedRecipe.output[id]);
    showToast(`Craft réussi : ${selectedRecipe.title}`);
    updateInventoryGrid();
    updateHotbar();
    progressTutorial('craft');
  }

  renderRecipes();

  // --- Tutoriel guidé ---
  const tutorialSteps = [
    { id: 'look', text: 'Regarde autour de toi avec la souris.' },
    { id: 'move', text: 'Déplace-toi avec ZQSD / WASD.' },
    { id: 'mine', text: 'Vise un bloc de terre et mine-le avec Clic gauche.' },
    { id: 'collect', text: "Ramasse la ressource. Observe l'inventaire." },
    { id: 'inventory', text: "Ouvre l'inventaire/craft avec la touche E." },
    { id: 'craft', text: 'Fabrique des Planches ou des Torches avec tes ressources.' },
    { id: 'place', text: 'Sélectionne un objet crafté et pose-le avec Clic droit.' },
  ];
  let tutorialIndex = 0;

  function setTutorial(text) {
    tutorialBox.textContent = text;
  }
  setTutorial(tutorialSteps[0].text);

  function progressTutorial(action) {
    const step = tutorialSteps[tutorialIndex];
    const goals = {
      look: ['look'],
      move: ['move'],
      mine: ['mine'],
      collect: ['collect'],
      inventory: ['inventory'],
      craft: ['craft'],
      place: ['place']
    };
    if (goals[action] && goals[action][0] === step.id) {
      tutorialIndex++;
      if (tutorialIndex >= tutorialSteps.length) {
        setTutorial('Tutoriel terminé ! À toi de jouer.');
        setTimeout(() => tutorialBox.classList.add('hidden'), 4000);
      } else {
        setTutorial(tutorialSteps[tutorialIndex].text);
      }
    }
  }

  // --- Controls ---
  let flyMode = false;
  let photoMode = false;

  function setFlyMode(enabled) {
    flyMode = enabled;
    const body = noa.ents.getPhysics(noa.playerEntity);
    body.gravityMultiplier = enabled ? 0 : 1;
    body.airDrag = enabled ? 0.2 : 0.01;
    showToast(enabled ? 'Exploration libre activée' : 'Mode gravité activé');
  }

  // Caméra bobbing léger pour le ressenti
  let walkTime = 0;
  noa.on('beforeRender', function(dt) {
    const state = noa.inputs.state;
    const moving = state.forward || state.backward || state.left || state.right;
    walkTime += moving ? dt : 0;
    const amp = moving ? 0.05 : 0;
    noa.camera.cameraOffset.y = 0.1 + Math.sin(walkTime * 8) * amp;

    // Highlight bloc visé
    const target = noa.getTargetBlock();
    if (target) {
      noa.rendering.highlightedBlock = { position: target.position }; // outline simple
    } else {
      noa.rendering.highlightedBlock = null;
    }
  });

  // Pointer lock on click
  canvas.addEventListener('click', () => {
    if (photoMode) return;
    noa.container.enterPointerLock();
    progressTutorial('look');
  });

  // Mouse move detection for tutorial
  window.addEventListener('mousemove', () => progressTutorial('look'), { once: true });

  // Mining / placing
  window.addEventListener('mousedown', e => {
    if (photoMode || inventoryOverlay.classList.contains('hidden') === false) return;
    const target = noa.getTargetBlock();
    if (!target) return;
    if (e.button === 0) {
      // Mine block
      const id = noa.getBlock(target.position[0], target.position[1], target.position[2]);
      if (id !== BLOCKS.air) {
        noa.setBlock(BLOCKS.air, target.position);
        inventory[id] = (inventory[id] || 0) + 1;
        updateHotbar();
        progressTutorial('mine');
        progressTutorial('collect');
      }
    }
    if (e.button === 2) {
      const placeID = hotbarSlots[hotIndex];
      if ((inventory[placeID] || 0) <= 0) { showToast('Rien à placer dans ce slot.'); return; }
      const pos = target.adjacent;
      noa.setBlock(placeID, pos);
      inventory[placeID] -= 1;
      updateHotbar();
      progressTutorial('place');
    }
  });

  // Scroll hotbar
  window.addEventListener('wheel', e => {
    hotIndex = (hotIndex + (e.deltaY > 0 ? 1 : -1) + hotbarSlots.length) % hotbarSlots.length;
    updateHotbar();
  });

  // Keyboard
  window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'e') {
      toggleInventory();
    }
    if (e.key === 'p') togglePhotoMode();
    if (e.key === ' ') progressTutorial('move');
  });

  noa.inputs.down.on('forward', () => progressTutorial('move'));
  noa.inputs.down.on('backward', () => progressTutorial('move'));
  noa.inputs.down.on('left', () => progressTutorial('move'));
  noa.inputs.down.on('right', () => progressTutorial('move'));

  // Inventory toggle
  function toggleInventory() {
    const open = inventoryOverlay.classList.contains('hidden');
    if (open) {
      inventoryOverlay.classList.remove('hidden');
      updateInventoryGrid();
      renderRecipes();
      craftResult.textContent = 'Sélectionne une recette';
      progressTutorial('inventory');
    } else {
      inventoryOverlay.classList.add('hidden');
    }
  }
  document.getElementById('close-inventory').onclick = toggleInventory;

  // Menu actions
  document.getElementById('btn-play').onclick = () => startGame(false);
  document.getElementById('btn-fly').onclick = () => startGame(true);
  document.getElementById('btn-photo').onclick = () => { startGame(false); togglePhotoMode(); };

  function startGame(fly) {
    title.classList.add('hidden');
    hud.classList.remove('hidden');
    canvas.focus();
    setFlyMode(fly);
    noa.container.enterPointerLock();
    showToast(fly ? 'Exploration libre' : 'Mode survie léger');
  }

  // Téléportations
  const teleportPositions = {
    spawn: [0, 80, 0],
    hill: [hillPosition[0], 90, hillPosition[2]],
    lake: [lakeCenter[0], 70, lakeCenter[2] + lakeRadius]
  };
  teleportPanel.querySelectorAll('button').forEach(btn => btn.onclick = () => teleport(btn.dataset.target));
  function teleport(target) {
    const pos = teleportPositions[target];
    if (!pos) return;
    noa.setPlayerPosition(pos[0], pos[1], pos[2]);
    showToast(`Téléporté vers ${target}`);
  }

  // Photo mode
  function togglePhotoMode() {
    photoMode = !photoMode;
    photoPanel.classList.toggle('hidden', !photoMode);
    hud.classList.toggle('hidden', photoMode);
    title.classList.add('hidden');
    if (!photoMode) {
      hud.classList.remove('hidden');
    }
    showToast(photoMode ? 'Mode photo activé' : 'Mode photo désactivé');
  }
  document.getElementById('capture-btn').onclick = () => {
    const data = canvas.toDataURL('image/png');
    const w = window.open('about:blank', 'capture');
    w.document.write(`<img src="${data}" alt="capture" style="width:100%"/>`);
  };
  document.getElementById('time-slider').oninput = e => {
    const t = parseFloat(e.target.value);
    sun.intensity = 0.6 + t * 1.2;
    scene.clearColor = new BABYLON.Color3(0.02 + t * 0.08, 0.05 + t * 0.1, 0.1 + t * 0.12);
  };
  document.getElementById('fog-slider').oninput = e => {
    scene.fogDensity = parseFloat(e.target.value);
  };

  // Toasts
  let toastTimeout = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.add('hidden'), 2000);
  }

  // Spawn joueur en surface
  function findSurface(x = 0, z = 0) {
    for (let y = worldHeight; y > 0; y--) {
      const id = noa.getBlock(x, y, z);
      if (id && id !== BLOCKS.air) return y + 2;
    }
    return 80;
  }
  noa.setPlayerPosition(0, findSurface(), 0);
  updateHotbar();

  // Petit onboarding initial
  showToast('Bienvenue ! Clique pour pointer-lock. E pour inventaire.');
})();
