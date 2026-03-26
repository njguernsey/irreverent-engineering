require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI('AIzaSyB8wi79eyw4qlJmyhchUkcCGAdYZkonIhQ');

const broccoliFacts = {
    "what is broccoli": "Broccoli is an edible green plant in the cabbage family whose large flowering head, stalk and small associated leaves are eaten as a vegetable.",
    "is broccoli healthy": "Yes, broccoli is highly nutritious, rich in vitamins C and K, fiber, and various antioxidants.",
    "how do you cook broccoli": "Broccoli can be steamed, roasted, sautéed, or eaten raw. Steaming is often recommended to retain the most nutrients.",
    "what color is broccoli": "Broccoli is typically green, though some varieties can be purple."
};

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    const lowerMessage = message.toLowerCase().replace(/[?]/g, '');

    // Check database first
    if (broccoliFacts[lowerMessage]) {
        return res.json({ reply: broccoliFacts[lowerMessage] });
    }

    // Fallback to AI
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
