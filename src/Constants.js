export const GRAVITY = 30.0;
export const CHUNK_SIZE = 32;

export const BLOCKS = {
    AIR: 0,
    DIRT: 1, GRASS: 2, STONE: 3, WOOD: 4, LEAVES: 5,
    PLANKS: 6, BRICK: 7, BEDROCK: 99,
    WATER: 10, SAND: 11
};

// On sépare les outils des blocs pour l'affichage
export const TOOLS = {
    PICKAXE: 100
};

export const BLOCK_PROPS = {
    [BLOCKS.DIRT]: { color: 0x8B4513, name: "Terre" },
    [BLOCKS.GRASS]: { color: 0x4CBB17, name: "Herbe" },
    [BLOCKS.STONE]: { color: 0x808080, name: "Pierre" },
    [BLOCKS.WOOD]: { color: 0x5D4037, name: "Bois Brut" },
    [BLOCKS.LEAVES]: { color: 0x228B22, name: "Feuilles" },
    [BLOCKS.PLANKS]: { color: 0xDEB887, name: "Planches de Bois" },
    [BLOCKS.BRICK]: { color: 0xA52A2A, name: "Mur de Briques" },
    [BLOCKS.BEDROCK]: { color: 0x222222, name: "Bedrock (Indestructible)" },
    [BLOCKS.WATER]: { color: 0x2255FF, name: "Eau", transparent: true, opacity: 0.6 },
    [BLOCKS.SAND]: { color: 0xE6C288, name: "Sable" },
    
    // Propriétés de la pioche
    [TOOLS.PICKAXE]: { color: 0x333333, name: "Pioche en Pierre", isTool: true }
};

export const RECIPES = [
    { 
        id: "planks", name: "Bois -> Planches (x4)", 
        input: { id: BLOCKS.WOOD, count: 1 }, 
        output: { id: BLOCKS.PLANKS, count: 4 } 
    },
    { 
        id: "brick", name: "Pierre -> Briques (x2)", 
        input: { id: BLOCKS.STONE, count: 1 }, 
        output: { id: BLOCKS.BRICK, count: 2 } 
    }
];