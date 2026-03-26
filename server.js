require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI('AIzaSyB8wi79eyw4qlJmyhchUkcCGAdYZkonIhQ');

const broccoliQA = [
  {
    id: "broccoli-nutrition-overview",
    question: "Is broccoli healthy?",
    aliases: ["is broccoli good for you", "broccoli health benefits"],
    category: "nutrition",
    answer: "Yes, broccoli is highly nutritious, rich in vitamins C and K, fiber, and antioxidants."
  },
  {
    id: "broccoli-origin",
    question: "Where does broccoli come from?",
    aliases: ["origin of broccoli", "where was broccoli first grown"],
    category: "history",
    answer: "Broccoli originated in the Mediterranean and was cultivated in Italy over 2,000 years ago."
  },
  {
    id: "broccoli-vs-cauliflower",
    question: "What is the difference between broccoli and cauliflower?",
    aliases: ["broccoli vs cauliflower", "difference cauliflower broccoli"],
    category: "comparison",
    answer: "Broccoli is green with flowering florets, while cauliflower is typically white and more compact, though both are cruciferous vegetables."
  },
  {
    id: "broccoli-carb-content",
    question: "How many carbs are in broccoli?",
    aliases: ["broccoli carbs", "carbohydrates in broccoli"],
    category: "nutrition",
    answer: "One cup of raw broccoli contains about 6 grams of carbohydrates."
  },
  {
    id: "broccoli-protein-per-100g",
    question: "How much protein is in broccoli per 100 grams?",
    aliases: ["broccoli protein 100g", "protein content broccoli"],
    category: "nutrition",
    answer: "Broccoli contains about 2.8 grams of protein per 100 grams."
  },
  {
    id: "broccoli-daily-intake",
    question: "How much broccoli should you eat per day?",
    aliases: ["daily broccoli intake", "recommended broccoli amount"],
    category: "nutrition",
    answer: "A serving of about 1 cup per day is generally considered a healthy amount."
  },
  {
    id: "broccoli-weight",
    question: "How much does a head of broccoli weigh?",
    aliases: ["weight of broccoli head", "average broccoli weight"],
    category: "general",
    answer: "A typical head of broccoli weighs about 300 to 500 grams."
  },
  {
    id: "broccoli-growing-time",
    question: "How long does broccoli take to grow?",
    aliases: ["broccoli growth time", "how fast does broccoli grow"],
    category: "gardening",
    answer: "Broccoli typically takes 60 to 100 days to grow, depending on the variety."
  },
  {
    id: "broccoli-growing-conditions",
    question: "What conditions does broccoli need to grow?",
    aliases: ["how to grow broccoli", "broccoli growing requirements"],
    category: "gardening",
    answer: "Broccoli grows best in cool weather, full sun, and well-drained soil rich in organic matter."
  },
  {
    id: "broccoli-water-content",
    question: "How much water is in broccoli?",
    aliases: ["broccoli water percentage", "is broccoli mostly water"],
    category: "nutrition",
    answer: "Broccoli is about 89% water."
  },
  {
    id: "broccoli-vitamin-c",
    question: "Is broccoli high in vitamin C?",
    aliases: ["vitamin c in broccoli", "does broccoli have vitamin c"],
    category: "nutrition",
    answer: "Yes, broccoli is very high in vitamin C, providing more than the daily requirement per serving."
  },
  {
    id: "broccoli-vitamin-k",
    question: "Is broccoli high in vitamin K?",
    aliases: ["vitamin k broccoli", "does broccoli contain vitamin k"],
    category: "nutrition",
    answer: "Yes, broccoli is an excellent source of vitamin K."
  },
  {
    id: "broccoli-folate",
    question: "Does broccoli contain folate?",
    aliases: ["folic acid broccoli", "broccoli folate content"],
    category: "nutrition",
    answer: "Yes, broccoli contains folate, which is important for cell growth and development."
  },
  {
    id: "broccoli-pregnancy",
    question: "Is broccoli good during pregnancy?",
    aliases: ["can pregnant women eat broccoli", "broccoli pregnancy benefits"],
    category: "health",
    answer: "Yes, broccoli is beneficial during pregnancy due to its folate, fiber, and vitamin content."
  },
  {
    id: "broccoli-allergy",
    question: "Can people be allergic to broccoli?",
    aliases: ["broccoli allergy symptoms", "is broccoli allergenic"],
    category: "health",
    answer: "Yes, though rare, some people can have allergic reactions to broccoli."
  },
  {
    id: "broccoli-thyroid",
    question: "Does broccoli affect the thyroid?",
    aliases: ["broccoli thyroid function", "goitrogens broccoli"],
    category: "health",
    answer: "Broccoli contains goitrogens, but normal consumption is unlikely to affect thyroid function in healthy individuals."
  },
  {
    id: "broccoli-raw-vs-cooked",
    question: "Is raw or cooked broccoli better?",
    aliases: ["raw vs cooked broccoli", "which is healthier broccoli"],
    category: "nutrition",
    answer: "Both have benefits; raw retains more vitamin C, while cooking can increase availability of some antioxidants."
  },
  {
    id: "broccoli-digestion-raw",
    question: "Is raw broccoli harder to digest?",
    aliases: ["raw broccoli digestion", "does raw broccoli upset stomach"],
    category: "health",
    answer: "Yes, raw broccoli can be harder to digest for some people due to its fiber and compounds."
  },
  {
    id: "broccoli-meal-prep",
    question: "Is broccoli good for meal prep?",
    aliases: ["can you meal prep broccoli", "broccoli for weekly meals"],
    category: "cooking",
    answer: "Yes, broccoli stores well and reheats easily, making it ideal for meal prep."
  },
  {
    id: "broccoli-reheating",
    question: "Can you reheat broccoli?",
    aliases: ["reheat cooked broccoli", "microwave leftover broccoli"],
    category: "cooking",
    answer: "Yes, broccoli can be reheated, though it may become softer."
  },
  {
    id: "broccoli-soup",
    question: "Can you make soup with broccoli?",
    aliases: ["broccoli soup recipe", "is broccoli good in soup"],
    category: "cooking",
    answer: "Yes, broccoli is commonly used in soups, especially creamy or blended varieties."
  },
  {
    id: "broccoli-smoothies",
    question: "Can you put broccoli in smoothies?",
    aliases: ["broccoli smoothie", "blend broccoli drinks"],
    category: "cooking",
    answer: "Yes, small amounts of broccoli can be added to smoothies for extra nutrients."
  },
  {
    id: "broccoli-pasta",
    question: "Does broccoli go well with pasta?",
    aliases: ["broccoli pasta dishes", "pasta with broccoli"],
    category: "cooking",
    answer: "Yes, broccoli pairs well with pasta, especially with garlic, olive oil, and cheese."
  },
  {
    id: "broccoli-rice",
    question: "What is broccoli rice?",
    aliases: ["riced broccoli", "how to make broccoli rice"],
    category: "cooking",
    answer: "Broccoli rice is finely chopped broccoli used as a low-carb alternative to rice."
  },
  {
    id: "broccoli-calcium-absorption",
    question: "Is calcium from broccoli well absorbed?",
    aliases: ["broccoli calcium bioavailability", "absorb calcium broccoli"],
    category: "nutrition",
    answer: "Yes, calcium from broccoli is relatively well absorbed compared to some plant sources."
  },
  {
    id: "broccoli-blood-pressure",
    question: "Is broccoli good for blood pressure?",
    aliases: ["broccoli hypertension", "does broccoli lower blood pressure"],
    category: "health",
    answer: "Yes, nutrients in broccoli like potassium and antioxidants support healthy blood pressure."
  },
  {
    id: "broccoli-cholesterol",
    question: "Does broccoli help lower cholesterol?",
    aliases: ["broccoli cholesterol benefits", "fiber broccoli cholesterol"],
    category: "health",
    answer: "Yes, the fiber in broccoli may help reduce cholesterol levels."
  },
  {
    id: "broccoli-cancer-research",
    question: "Does broccoli help prevent cancer?",
    aliases: ["broccoli cancer prevention", "sulforaphane cancer"],
    category: "health",
    answer: "Broccoli contains compounds like sulforaphane that are being studied for cancer prevention benefits."
  },
  {
    id: "broccoli-sprouts",
    question: "What are broccoli sprouts?",
    aliases: ["sprouted broccoli", "are broccoli sprouts healthy"],
    category: "nutrition",
    answer: "Broccoli sprouts are young broccoli plants rich in concentrated nutrients like sulforaphane."
  },
  {
    id: "broccoli-sprouts-vs-broccoli",
    question: "Are broccoli sprouts healthier than broccoli?",
    aliases: ["sprouts vs broccoli nutrition", "which is healthier broccoli sprouts"],
    category: "nutrition",
    answer: "Broccoli sprouts often contain higher concentrations of certain compounds like sulforaphane."
  },
  {
    id: "broccoli-pets-cats",
    question: "Can cats eat broccoli?",
    aliases: ["is broccoli safe for cats", "cats broccoli"],
    category: "animals",
    answer: "Yes, cats can eat small amounts of broccoli, but it is not necessary for their diet."
  },
  {
    id: "broccoli-companion-foods",
    question: "What foods pair well with broccoli?",
    aliases: ["what goes with broccoli", "broccoli pairings"],
    category: "cooking",
    answer: "Broccoli pairs well with garlic, lemon, cheese, chicken, beef, and grains."
  },
  {
    id: "broccoli-shelf-life-cooked",
    question: "How long does cooked broccoli last?",
    aliases: ["leftover broccoli shelf life", "cooked broccoli fridge"],
    category: "storage",
    answer: "Cooked broccoli lasts about 3 to 4 days in the refrigerator."
  },
  {
    id: "broccoli-room-temperature",
    question: "Can broccoli be left out?",
    aliases: ["broccoli room temperature", "does broccoli spoil quickly"],
    category: "storage",
    answer: "Broccoli should not be left out for more than 2 hours, as it can spoil."
  },
  {
    id: "broccoli-mold",
    question: "Can broccoli grow mold?",
    aliases: ["moldy broccoli safety", "white fuzz broccoli"],
    category: "storage",
    answer: "Yes, broccoli can develop mold if stored too long or in moist conditions."
  },
  {
    id: "broccoli-bitter-fix",
    question: "How do you reduce bitterness in broccoli?",
    aliases: ["fix bitter broccoli", "make broccoli less bitter"],
    category: "cooking",
    answer: "Cooking methods like roasting or adding salt, acid, or fat can reduce bitterness."
  },
  {
    id: "broccoli-global-production",
    question: "Where is most broccoli grown?",
    aliases: ["top broccoli producing countries", "broccoli farming locations"],
    category: "agriculture",
    answer: "China and India are among the largest producers of broccoli globally."
  }
];

function normalize(text) {
    return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function tokenize(text) {
    return normalize(text).split(" ");
}

function buildIndex(data) {
    return data.map(item => {
        const allPhrases = [item.question, ...(item.aliases || [])];
        return {
            ...item,
            normalized: allPhrases.map(p => normalize(p)),
            tokens: allPhrases.flatMap(p => tokenize(p))
        };
    });
}

const index = buildIndex(broccoliQA);

function scoreItem(query, item) {
    const q = normalize(query);
    const qTokens = tokenize(query);
    let score = 0;
    if (item.normalized.includes(q)) score += 100;
    for (const phrase of item.normalized) {
        if (phrase.includes(q)) score += 40;
        if (q.includes(phrase)) score += 30;
    }
    const overlap = qTokens.filter(t => item.tokens.includes(t)).length;
    score += overlap * 10;
    score -= Math.abs(item.tokens.length - qTokens.length);
    return score;
}

function searchBroccoli(query, index) {
    const scored = index.map(item => ({ item, score: scoreItem(query, item) }));
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];
    console.log('Query:', query, 'Top score:', top ? top.score : 'none', 'Top item:', top ? top.item.question : 'none');
    if (!top || top.score < 10) return { answer: null };
    return { answer: top.item.answer };
}

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    const searchResult = searchBroccoli(message, index);

    if (searchResult.answer) {
        return res.json({ reply: searchResult.answer });
    }

    // AI component commented out as requested
    /*
    try {
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-2.0-flash',
            systemInstruction: 'You are a helpful assistant that only answers questions about broccoli. If the user asks about anything else, politely steer the conversation back to broccoli.'
        });
        const result = await model.generateContent(message);
        const response = await result.response;
        res.json({ reply: response.text() });
    } catch (error) {
        console.error('Error:', error);
        res.json({ reply: "Sorry, I'm having trouble connecting to my brain right now." });
    }
    */
    res.json({ reply: "I'm sorry, I don't have an answer for that about broccoli right now." });
});

const PORT = process.env.PORT || 3000;

app.use(express.static('../'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
