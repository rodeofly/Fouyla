import { BLOCKS, BLOCK_PROPS, RECIPES, TOOLS } from './Constants.js';

export class UIManager {
    constructor(player) {
        this.player = player;
        this.isOpen = false;
        this.setupEvents();
    }

    setupEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyE') this.toggleInventory();
            if (e.code.startsWith('Digit')) {
                const idx = parseInt(e.code.replace('Digit', '')) - 1;
                if(idx >= 0 && idx < 5) this.selectHotbarSlot(idx);
            }
        });
        
        // Mise à jour au scroll
        window.addEventListener('update-hotbar', () => this.updateHUD());
    }

    toggleInventory() {
        const screen = document.getElementById('inventory-screen');
        this.isOpen = !this.isOpen;
        
        if (this.isOpen) {
            screen.style.display = 'flex';
            this.player.controls.unlock();
            this.refreshInventoryGrid();
            this.refreshCrafting();
        } else {
            screen.style.display = 'none';
            this.player.controls.lock();
        }
        this.updateHUD();
    }

    updateHUD() {
        const hb = document.getElementById('hotbar');
        hb.innerHTML = '';
        this.player.hotbar.forEach((id, i) => {
            const slot = document.createElement('div');
            slot.className = 'slot ' + (i === this.player.selectedSlot ? 'active' : '');
            
            if (id !== 0) {
                const props = BLOCK_PROPS[id];
                if(props) {
                    // Si c'est un outil, on met une icone spéciale ou une couleur différente
                    if(id === TOOLS.PICKAXE) {
                        slot.style.backgroundColor = '#555';
                        slot.style.border = '2px solid cyan';
                        slot.innerHTML = '<span style="font-size:20px;">⛏️</span>';
                    } else {
                        slot.style.backgroundColor = '#' + props.color.toString(16);
                        slot.innerHTML = `<span class="qty">${this.player.inventory[id]}</span>`;
                    }
                }
            }
            hb.appendChild(slot);
        });

        const currentId = this.player.hotbar[this.player.selectedSlot];
        const nameEl = document.getElementById('item-name');
        if(currentId && BLOCK_PROPS[currentId]) {
            nameEl.innerText = BLOCK_PROPS[currentId].name;
            nameEl.style.color = currentId === TOOLS.PICKAXE ? "cyan" : "white";
        } else {
            nameEl.innerText = "Main vide";
        }
    }

    selectHotbarSlot(i) {
        this.player.selectedSlot = i;
        this.updateHUD();
        // Notifier le joueur pour changer l'objet en main (visuel)
        this.player.updateHandVisual();
    }

    refreshInventoryGrid() {
        const grid = document.getElementById('inventory-grid');
        grid.innerHTML = '';

        // Liste combinée Blocs + Outils
        const allItems = [...Object.values(BLOCKS), ...Object.values(TOOLS)].filter(id => id !== 0);

        allItems.forEach((id) => {
            // On n'affiche que ce qu'on a dans l'inventaire OU les outils (qui sont uniques)
            if(this.player.inventory[id] > 0 || id === TOOLS.PICKAXE) {
                const slot = document.createElement('div');
                const props = BLOCK_PROPS[id];
                
                slot.className = 'slot';
                slot.style.backgroundColor = '#' + props.color.toString(16);
                
                // --- ERGONOMIE : Nom au survol ---
                slot.title = props.name; 

                if(id === TOOLS.PICKAXE) {
                    slot.innerHTML = '⛏️';
                } else {
                    slot.innerHTML = `<span class="qty">${this.player.inventory[id]}</span>`;
                }
                
                slot.onclick = () => {
                    this.player.hotbar[this.player.selectedSlot] = id;
                    this.updateHUD();
                    this.player.updateHandVisual();
                };
                grid.appendChild(slot);
            }
        });
    }

    refreshCrafting() {
        const list = document.getElementById('crafting-list');
        list.innerHTML = '';

        RECIPES.forEach(recipe => {
            const btn = document.createElement('button');
            btn.className = 'craft-btn';
            
            const inputName = BLOCK_PROPS[recipe.input.id].name;
            const currentInput = this.player.inventory[recipe.input.id] || 0;
            const canCraft = currentInput >= recipe.input.count;

            btn.innerHTML = `<b>${recipe.name}</b><br><small>Coût: ${recipe.input.count} ${inputName}</small>`;
            btn.disabled = !canCraft;
            if(canCraft) btn.style.borderColor = "lime";
            
            btn.onclick = () => {
                if(canCraft) {
                    this.player.inventory[recipe.input.id] -= recipe.input.count;
                    this.player.inventory[recipe.output.id] = (this.player.inventory[recipe.output.id] || 0) + recipe.output.count;
                    this.refreshInventoryGrid();
                    this.refreshCrafting();
                    this.updateHUD();
                }
            };
            list.appendChild(btn);
        });
    }
}