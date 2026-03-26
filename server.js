require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI('AIzaSyB8wi79eyw4qlJmyhchUkcCGAdYZkonIhQ');

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;

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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
