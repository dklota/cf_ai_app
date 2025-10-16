## AI-Powered Retrieval Augmented Generation (RAG) Chatbot

The chatbot is themed as an NBA analyst, capable of answering general NBA questions or specific facts you input into its knowledge base.

### [Access the chatbot here!](https://rag-bot.divleen2.workers.dev)

### Project Architecture:
Frontend: A simple HTML/JS chat interface (ui.html) served by the Worker.

API Gateway (Hono Worker): Routes / and /notes requests.

Data Ingestion (POST /notes):

The user submits a new Note.

The Worker triggers the RAGWorkflow asynchronously.

The Workflow splits the text, inserts the raw text into D1 (Database), generates embeddings via Workers AI (Embedding Model), and stores the vector in Vectorize (Vector Database).

Query Path (GET /api/query):

The user asks a Question.

The Worker generates an embedding of the question (Workers AI).

The Worker queries Vectorize to find relevant note IDs.

The Worker fetches the full context/notes from D1.

The Worker constructs a final System Prompt using the retrieved context (RAG).

The Worker calls Llama 3.3 (LLM) for the final answer.


