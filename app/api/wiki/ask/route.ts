import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { listWikiNodes, getDocumentContent } from '@/lib/lark'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json()
    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Fetch all wiki nodes and find the most relevant ones by keyword matching
    const allNodes = await listWikiNodes()

    const q = question.toLowerCase()
    const keywords = q.split(/\s+/).filter((w: string) => w.length > 2)

    // Score nodes by how many question keywords appear in the title
    const scored = allNodes
      .map(n => ({
        ...n,
        score: keywords.filter((k: string) => n.title.toLowerCase().includes(k)).length,
      }))
      .sort((a, b) => b.score - a.score)

    // Take up to 3 most relevant nodes (or first 3 if no title match)
    const candidates = scored.slice(0, 3).filter(n => n.obj_token)

    // Fetch content for each candidate
    const contexts: { title: string; content: string }[] = []
    for (const node of candidates) {
      try {
        const content = await getDocumentContent(node.obj_token)
        if (content.trim()) contexts.push({ title: node.title, content: content.trim() })
      } catch {
        // skip pages we can't read
      }
    }

    const contextBlock = contexts.length > 0
      ? contexts.map(c => `## ${c.title}\n\n${c.content}`).join('\n\n---\n\n')
      : 'No wiki content available.'

    // Ask Claude with the fetched content as context
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are a BizOS SOP assistant for Hoho Wellness. Answer based only on the wiki content provided below. If the answer is not in the provided content, say so clearly. When citing information, mention the wiki page title.

Wiki content:
${contextBlock}`,
      messages: [{ role: 'user', content: question.trim() }],
    })

    const answer = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('')
      || 'I could not find relevant information in the wiki for your question.'

    const source = contexts[0]?.title

    return NextResponse.json({ answer, source })
  } catch (e: any) {
    console.error('[wiki/ask]', e)
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
