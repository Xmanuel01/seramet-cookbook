import type { Recipe } from "../types"

export const defaultCategories = [
  "All",
  "Main Dishes",
  "Rice",
  "Stews",
  "Vegetables",
  "Breads",
  "Snacks",
  "Drinks",
]

export const seedRecipes: Recipe[] = [
  {
    id: "beef-pilau",
    name: "Beef Pilau",
    category: "Rice",
    description: "Fragrant Swahili pilau cooked with beef, warm spices and rice.",
    portions: 10,
    portionSize: "340 g",
    prepMinutes: 20,
    cookMinutes: 45,
    image: "linear-gradient(135deg, #8a5b34 0%, #ca925d 46%, #50734a 100%)",
    ingredients: [
      { id: "i1", name: "Rice", quantity: "1.5 kg" },
      { id: "i2", name: "Beef, boneless", quantity: "1 kg" },
      { id: "i3", name: "Onions", quantity: "500 g" },
      { id: "i4", name: "Tomatoes", quantity: "500 g" },
      { id: "i5", name: "Cooking oil", quantity: "200 ml" },
      { id: "i6", name: "Pilau masala", quantity: "50 g" },
      { id: "i7", name: "Garlic", quantity: "30 g" },
      { id: "i8", name: "Ginger", quantity: "30 g" }
    ],
    method: [
      "Prepare and portion all ingredients before cooking.",
      "Brown the onions slowly until deep golden, then add garlic, ginger and pilau masala.",
      "Add beef and cook until well sealed before adding tomatoes.",
      "Add measured water, bring to a simmer, then add washed rice.",
      "Cover and cook on low heat until the rice is tender and the liquid is absorbed.",
      "Rest before portioning to maintain texture and consistency."
    ],
    notes: "Use the approved rice and measure water precisely. Adjust seasoning before the rice goes in.",
    published: true
  },
  {
    id: "chicken-biryani",
    name: "Chicken Biryani",
    category: "Rice",
    description: "Layered rice and spiced chicken finished in the Mona Swahili style.",
    portions: 10,
    portionSize: "340 g",
    prepMinutes: 30,
    cookMinutes: 55,
    image: "linear-gradient(135deg, #efbd73 0%, #d3703e 54%, #5d8c4d 100%)",
    ingredients: [
      { id: "i1", name: "Basmati rice", quantity: "1.6 kg" },
      { id: "i2", name: "Chicken", quantity: "2 kg" },
      { id: "i3", name: "Onions", quantity: "600 g" },
      { id: "i4", name: "Biryani masala", quantity: "60 g" }
    ],
    method: ["Marinate the chicken.", "Prepare the sauce.", "Par-cook the rice.", "Layer and finish gently."],
    notes: "Do not overcook the rice before layering.",
    published: true
  },
  {
    id: "maharagwe",
    name: "Maharagwe",
    category: "Stews",
    description: "Slow-cooked beans in a rich, gently spiced sauce.",
    portions: 10,
    portionSize: "340 g",
    prepMinutes: 15,
    cookMinutes: 40,
    image: "linear-gradient(135deg, #673127 0%, #a54c34 52%, #cf805c 100%)",
    ingredients: [
      { id: "i1", name: "Beans", quantity: "2 kg" },
      { id: "i2", name: "Tomatoes", quantity: "450 g" },
      { id: "i3", name: "Onions", quantity: "350 g" }
    ],
    method: ["Cook beans until tender.", "Prepare the sauce base.", "Combine and simmer until balanced."],
    published: true
  },
  {
    id: "sukuma-wiki",
    name: "Sukuma Wiki",
    category: "Vegetables",
    description: "Fresh greens sautéed quickly for colour, texture and flavour.",
    portions: 10,
    portionSize: "180 g",
    prepMinutes: 15,
    cookMinutes: 15,
    image: "linear-gradient(135deg, #174b37 0%, #478455 56%, #91b96a 100%)",
    ingredients: [
      { id: "i1", name: "Sukuma wiki", quantity: "2.2 kg" },
      { id: "i2", name: "Onions", quantity: "250 g" }
    ],
    method: ["Wash and slice.", "Sauté aromatics.", "Add greens and finish quickly."],
    published: true
  },
  {
    id: "chapati",
    name: "Chapati",
    category: "Breads",
    description: "Soft layered chapati prepared for consistent size and texture.",
    portions: 20,
    portionSize: "1 piece",
    prepMinutes: 35,
    cookMinutes: 30,
    image: "linear-gradient(135deg, #d6bc8f 0%, #b38a55 55%, #78583a 100%)",
    ingredients: [
      { id: "i1", name: "Wheat flour", quantity: "2 kg" },
      { id: "i2", name: "Cooking oil", quantity: "250 ml" }
    ],
    method: ["Mix dough.", "Rest.", "Portion and roll.", "Cook on a hot pan."],
    published: true
  },
  {
    id: "dengu",
    name: "Dengu",
    category: "Stews",
    description: "Green grams cooked into a smooth, balanced stew.",
    portions: 10,
    portionSize: "340 g",
    prepMinutes: 15,
    cookMinutes: 40,
    image: "linear-gradient(135deg, #75632f 0%, #a18542 53%, #5f7d3d 100%)",
    ingredients: [
      { id: "i1", name: "Green grams", quantity: "1.8 kg" },
      { id: "i2", name: "Onions", quantity: "350 g" }
    ],
    method: ["Boil green grams.", "Prepare the base.", "Combine and simmer."],
    published: true
  }
]
