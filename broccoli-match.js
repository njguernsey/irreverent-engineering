// Ranks broccoli facts against a question. Shared by the chat page (offline
// fallback) and the Worker (picks the facts the AI gets as reference).

const STOPWORDS = new Set((
    'a an and are as at be but by can could do does did for from had has have how i if in into is it its ' +
    'me my of on or should so than that the their them there these they this to too was we were what when ' +
    'where which who why will with would you your about any much many get eat broccoli broccolis'
).split(' '));

export function normalize(text) {
    return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Content words only: "broccoli" and filler words match every fact, so they don't count
function keywords(text) {
    return normalize(text).split(' ').filter(w => w && !STOPWORDS.has(w)).map(stem);
}

// Light stemming so "calories" meets "calorie" and "cooking" meets "cooked"
function stem(w) {
    return w.length > 4 ? w.replace(/(ing|ed|s)$/, '') : w;
}

export function createMatcher(facts) {
    const index = facts.map(fact => {
        const phrases = [fact.question, ...(fact.aliases || [])].map(normalize);
        return { fact, phrases, words: new Set(phrases.flatMap(keywords)) };
    });

    // Best matches first; score is 0 when the question shares no content words with a fact
    function rank(query) {
        const q = normalize(query);
        const qWords = keywords(query);
        return index
            .map(({ fact, phrases, words }) => {
                const overlap = qWords.filter(w => words.has(w)).length;
                if (!overlap) return { fact, score: 0 };
                let score = overlap / Math.max(qWords.length, 1);
                if (phrases.includes(q)) score += 2;
                else if (phrases.some(p => p.includes(q) || q.includes(p))) score += 1;
                return { fact, score };
            })
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score);
    }

    // A single answer when more than half the question's content words match, or null
    function answer(query) {
        const top = rank(query)[0];
        return top && top.score > 0.5 ? top.fact.answer : null;
    }

    return { rank, answer };
}
