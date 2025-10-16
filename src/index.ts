import type { TextBlock } from '@anthropic-ai/sdk/resources';
import Anthropic from '@anthropic-ai/sdk';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { methodOverride } from 'hono/method-override'

// @ts-expect-error
import notes from './notes.html'
// @ts-expect-error
import ui from './ui.html'
// @ts-expect-error
import write from './write.html'

type Env = {
	AI: Ai;
	ANTHROPIC_API_KEY: string;
	database: D1Database;
	ENABLE_TEXT_SPLITTING: boolean | undefined;
	rag: Workflow;
	VECTORIZE: VectorizeIndex
};

type Note = {
	id: string;
	text: string;
}

type Params = {
	text: string;
};

const app = new Hono<{ Bindings: Env }>()
app.use(cors())

app.get('/notes.json', async (c) => {
	const query = `SELECT * FROM notes`
	const { results } = await c.env.database.prepare(query).all()
	return c.json({ data: results });
})

app.get('/notes', async (c) => {
	return c.html(notes);
})

app.use('/notes/:id', methodOverride({ app }))
app.delete('/notes/:id', async (c) => {
	const { id } = c.req.param();
	const query = `DELETE FROM notes WHERE id = ?`
	await c.env.database.prepare(query).bind(id).run()
	await c.env.VECTORIZE.deleteByIds([id])
	return c.redirect('/notes')
})

app.post('/notes', async (c) => {
	const { text } = await c.req.json();
	if (!text) return c.text("Missing text", 400);
	await c.env.rag.create({ params: { text } })
	return c.text("Created note", 201);
})

app.get('/', async (c) => {
	return c.html(ui);
})

app.get('/write', async (c) => {
	return c.html(write);
})

app.get('/api/query', async (c) => {
	const question = c.req.query('text');

	if (!question) {
		// return 400 Bad Request error if the user provides no input
		// prevents the RAG pipeline from running uselessly.
		return c.text("Please provide a question using the '?text=<your question>' query parameter.", 400);
	}

	const embeddings = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: question })
	const vectors = embeddings.data[0]

	const vectorQuery = await c.env.VECTORIZE.query(vectors, { topK: 3 });
	const vecId = vectorQuery.matches[0]?.id

	let notes: string[] = []
	if (vecId) {
		const query = `SELECT * FROM notes WHERE id = ?`
		const { results } = await c.env.database.prepare(query).bind(vecId).all<Note>()
		if (results) notes = results.map(note => note.text)
	}

	const contextMessage = notes.length
		? `Context:\n${notes.map(note => `- ${note}`).join("\n")}`
		: ""

	const systemPrompt = `You are an expert NBA analyst that stays up to date with NBA-related news, trades, and information across all sources. When answering the question or responding, use the context provided, if it is provided and relevant. Your responsibility is to answer only basketball and NBA related queries. If the query has been asked before, be sure to refer to the existing knowledge base. The year is 2025, so be sure to calculate dates and times accordingly. If you are unsure of the answer, simply state that you don't know. Do not make up an answer. Be concise with your answers.`

	let modelUsed: string = ""
	let response: AiTextGenerationOutput | Anthropic.Message

	if (c.env.ANTHROPIC_API_KEY) {
		const anthropic = new Anthropic({
			apiKey: c.env.ANTHROPIC_API_KEY
		})

		const model = "claude-3-5-sonnet-latest"
		modelUsed = model

		const message = await anthropic.messages.create({
			max_tokens: 1024,
			model,
			messages: [
				{ role: 'user', content: question }
			],
			system: [systemPrompt, contextMessage].join(" ")
		})

		response = {
			response: (message.content as TextBlock[]).map(content => content.text).join("\n")
		}
	} else {
		const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
		modelUsed = model

		response = await c.env.AI.run(
			model,
			{
				messages: [
					...(notes.length ? [{ role: 'system', content: contextMessage }] : []),
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: question }
				] as RoleScopedChatInput[]
			}
		) as AiTextGenerationOutput
	}

	if (response) {
		c.header('x-model-used', modelUsed)
		return c.text((response as any).response)
	} else {
		return c.text("We were unable to generate output", 500)
	}
})

export class RAGWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		const env = this.env;
		const { text } = event.payload;
		let texts: string[] = [text]

		if (env.ENABLE_TEXT_SPLITTING) {
			texts = await step.do('split text', async () => {
				const splitter = new RecursiveCharacterTextSplitter({
				});
				const output = await splitter.createDocuments([text]);
				return output.map(doc => doc.pageContent);
			})

			console.log("RecursiveCharacterTextSplitter generated ${texts.length} chunks")
		}

		for (const index in texts) {
			const text = texts[index]
			const record = await step.do(`create database record: ${index}/${texts.length}`, async () => {
				const query = "INSERT INTO notes (text) VALUES (?) RETURNING *"

				const { results } = await env.database.prepare(query)
					.bind(text)
					.run<Note>()

				const record = results[0]
				if (!record) throw new Error("Failed to create note")
				return record;
			})

			const embedding = await step.do(`generate embedding: ${index}/${texts.length}`, async () => {
				const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: text })
				const values = embeddings
				if (!values) throw new Error("Failed to generate vector embedding")
				return values
			})

			await step.do(`insert vector: ${index}/${texts.length}`, async () => {
				return env.VECTORIZE.upsert([
					{
						id: record.id.toString(),
						values: embedding,
					}
				]);
			})
		}
	}
}

export default app