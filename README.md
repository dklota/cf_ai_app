## NBA General Information Chatbot

The chatbot is themed as an NBA analyst, capable of answering general NBA questions or specific facts you input into its knowledge base. With the two days I had to complete this, I integrate llama 3.3 to serve as the LLM answering the user questions. 

### [Access the chatbot here!](https://rag-bot.divleen2.workers.dev)

### Project Architecture:

**Frontend:** A simple HTML/JS chat interface (ui.html) served by the Worker.

**API Gateway (Hono Worker):** Route requests.

**Query Path (GET /api/query):** The user asks a Question. The Worker calls Llama 3.3 (LLM) for the final answer.

### Challenges

Given that I only had two days to complete this application, there are a lot of further iterations that I would like to incorporate. My initial goal was to create a RAG-based chatbot such that user queries would be added into a D1 Database Storage on Cloudflare. However, I was running into some errors along the way where the RAG component was not adding any columns to the storage. Additionally, I pivoted to try to use Puppeteer to scrape data from the Basketball-Reference.com website to then add it to a D1 Database, but I was also running into some errors. Finally, I looked into AI Search on Cloudflare, which essentially works like AutoRAG, but I was unsure how the data would be retrieved up-to-date on a website rather than pdf. I am still going to work through these challenges to successfully incorporate RAG, but this is my current proof of concept. 

## Lessons Learned
I learned a lot throughout this process, and I was able to navigate pretty quickly how to use Cloudflare. I began by experimenting with the different types of templates provided, then I chose the Hello World Template to begin my project. Having access to the Cloudflare videos and blogs made it really quick and easy to build alongside them. I learned about Hono, a framework that I ended up implementing in this project. Cloudflare Workers and Cloudflare AI makes it super easy to build a quick chatbot and interface, and the agents-starter kit was extremely useful, providing a skeleton for a variety of use cases.

## Further Goals + Iterations
I am going to continue to iterate to ensure the RAG piece is successfully integrated and will be adding updates to the README accordingly. I will look into AI Search, Vectorize, and Puppeteer in more detail to see how to integrate into the existing code. 

## Use of AI
I used AI as a tool to support my learning, asking it to provide me details about some of the technologies, why use Hono, and options to proceed with a RAG-based approach for a website.


