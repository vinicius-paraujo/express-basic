const redis = require("redis");
const express = require("express");
const router = express.Router({ mergeParams: true });

const config = require("../../config.json");
const { getConnection, getDocument, updateDocument, deleteDocument, executeQuery } = require("../util/database");

const client = redis.createClient({
    host: config.redis.host,
    port: config.redis.port
});

client.on("error", (err) => {
    console.error("Redis client error:", err);
});

client.connect().then(() => {
    console.log("Redis connected.");
}).catch(console.error);

const requestLimit = (resource, limit = 10) => async (req, res, next) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    const key = `rate-limit-${resource}-${ip}`;
    let requestCount = await client.get(key);

    requestCount = requestCount ? Number(requestCount) : 0;
    requestCount += 1;

    console.log("Request Count:", requestCount);

    await client.set(key, requestCount, { EX: 30 });

    if (requestCount > limit) {
        return res.status(429).send({ error: "rate-limit" });
    }
    
    next();
};

const connection = getConnection();
if (connection) {
    console.log("Database successfully connected.");
}

const MAX_INT = 2147483647;
const MAX_TEXT_LENGTH = 65535;

const validateId = (id) => {
    return typeof id === 'number' && id >= 0 && id <= MAX_INT;
};

const validateContent = (content) => {
    return typeof content === 'string' && content.trim() !== '' && content.length <= MAX_TEXT_LENGTH;
};

router.get("/", requestLimit("root"), async (req, res) => {
    res.send({ message: "ok." })
});

router.get("/document/:id", requestLimit("document"), async (req, res) => {
    const { id } = req.params;

    if (!validateId(Number(id))) {
        return res.status(400).send({ error: "Invalid ID" });
    }

    const document = await getDocument(id);
    if (!document) {
        return res.status(404).send({ error: "Document not found" });
    }

    res.send({ document });
});

router.get("/document", requestLimit("document"), async (req, res) => {
    const documents = await executeQuery("SELECT * FROM documents");

    res.send({ documents });
});

router.post("/document", requestLimit("document"), async (req, res) => {
    if (!req.body || !req.body.id || !req.body.content) {
        return res.status(400).send({ error: "Invalid data" });
    }

    const { id, content } = req.body;

    if (!validateId(id) || !validateContent(content)) {
        return res.status(400).send({ error: "Invalid data" });
    }

    try {
        if (!await updateDocument(Number(id), content)) {
            res.status(400).send({ message: "Document not updated. Check data." });
            return;
        }

        res.send({ message: "Data updated." });
    } catch (error) {
        res.status(500).send({ error: 'An error occurred.' });
    }
});

router.patch("/document/:id", requestLimit("document"), async (req, res) => {
    if (!req.body || !req.body.content) {
        return res.status(400).send({ error: "Invalid data" });
    }

    const { id } = req.params;
    const { content } = req.body;

    if (!validateId(Number(id)) || !validateContent(content)) {
        return res.status(400).send({ error: "Invalid data" });
    }

    try {
        const document = await getDocument(id);
        if (!document) {
            return res.status(404).send({ error: "Document not found" });
        }

        if (!await updateDocument(Number(id), content)) {
            res.status(400).send({ message: "Document not updated. Maybe this id don't exists." });
            return;
        }

        res.send({ message: "Data updated." });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

router.delete("/document/:id", requestLimit("document"), async (req, res) => {
    const { id } = req.params;

    if (!validateId(Number(id))) {
        return res.status(400).send({ error: "Invalid ID" });
    }

    try {
        if (!await deleteDocument(id)) {
            res.status(400).send({ message: "Document not deleted. Maybe this id don't exists." });
            return;
        }

        res.send({ message: "Document deleted successfully" });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

module.exports = router;
