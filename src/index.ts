import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { methodOverride } from 'hono/method-override'

// @ts-expect-error
import ui from './ui.html'


type Ai = any;
type AiTextGenerationOutput = any;
type RoleScopedChatInput = any;

type Env = {
	AI: Ai;
};

const app = new Hono<{ Bindings: Env }>()
app.use(cors())

app.get('/', async (c) => {
	return c.html(ui);
})

app.get('/api/query', async (c) => {
	const question = c.req.query('text');

	if (!question) {
		// return 400 Bad Request error if the user provides no input
		// prevents the RAG pipeline from running uselessly.
		return c.text("Please provide a question using the '?text=<your question>' query parameter.", 400);
	}

	const contextMessage = "";

	const systemPrompt = `You are an expert NBA analyst that stays up to date with NBA-related news, trades, and information across all sources. When answering the question or responding, use the context provided, if it is provided and relevant. Your responsibility is to answer only basketball and NBA related queries. If the query has been asked before, be sure to refer to the existing knowledge base. The year is 2025, so be sure to calculate dates and times accordingly. If you are unsure of the answer, simply state that you don't know. Do not make up an answer. Be concise with your answers.`

	let modelUsed: string = ""
	let response: AiTextGenerationOutput

	const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
	modelUsed = model

	response = await c.env.AI.run(
		model,
		{
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: question }
			] as RoleScopedChatInput[],

			//tools: [{ type: "web_search" }] as any
		}
		) as AiTextGenerationOutput

	
	if (response && response.response) {
        c.header('x-model-used', modelUsed);
        	return c.text(response.response);
    	} else {
        	console.error("AI Response was null or missing 'response' property:", response);
        	return c.text("We were unable to generate output", 500);
    }
});

export default app