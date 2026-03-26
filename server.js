require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI('AIzaSyB8wi79eyw4qlJmyhchUkcCGAdYZkonIhQ');

const broccoliQA = [
    { question: "What is broccoli?", answer: "Broccoli is an edible green plant in the cabbage family whose large flowering head, stalk and small associated leaves are eaten as a vegetable.", aliases: ["what is broccoli", "define broccoli"] },
    { question: "Is broccoli healthy?", answer: "Yes, broccoli is highly nutritious, rich in vitamins C and K, fiber, and various antioxidants.", aliases: ["is broccoli good for you", "health benefits of broccoli"] },
    { question: "How do you cook broccoli?", answer: "Broccoli can be steamed, roasted, sautéed, or eaten raw. Steaming is often recommended to retain the most nutrients.", aliases: ["how to prepare broccoli", "best way to cook broccoli"] },
    { question: "What color is broccoli?", answer: "Broccoli is typically green, though some varieties can be purple.", aliases: ["what color is broccoli"] },
    { question: "Does broccoli have protein?", answer: "Yes, broccoli contains a small amount of protein, about 2.5 grams per cup of chopped raw broccoli.", aliases: ["protein in broccoli"] },
    { question: "Is broccoli a vegetable?", answer: "Yes, broccoli is a cruciferous vegetable.", aliases: ["is broccoli a vegetable"] },
    { question: "Can dogs eat broccoli?", answer: "Yes, dogs can eat broccoli in small quantities, but it should be plain and not seasoned.", aliases: ["can my dog eat broccoli"] },
    { question: "How long does broccoli last?", answer: "Fresh broccoli typically lasts 3-5 days in the refrigerator when stored properly in a plastic bag.", aliases: ["shelf life of broccoli", "how long does broccoli stay fresh"] },
    { question: "Is broccoli good for weight loss?", answer: "Yes, broccoli is low in calories and high in fiber, making it a great addition to a weight loss diet.", aliases: ["broccoli for weight loss"] },
    { question: "What is the best way to store broccoli?", answer: "Store broccoli in the refrigerator, ideally in a perforated plastic bag to allow for air circulation.", aliases: ["how to store broccoli"] }
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
    if (!top || top.score < 20) return { answer: null };
    return { answer: top.item.answer };
}

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    const searchResult = searchBroccoli(message, index);

    if (searchResult.answer) {
        return res.json({ reply: searchResult.answer });
    }

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
        res.status(500).json({ error: 'Failed to get response from Gemini' });
    }
});

const PORT = process.env.PORT || 3000;

app.use(express.static('../'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
