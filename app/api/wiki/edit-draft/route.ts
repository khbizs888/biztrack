import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { resolveNodeToDocId, getDocumentContent } from '@/lib/lark'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { nodeToken, instruction } = await req.json()
    if (!nodeToken || !instruction?.trim()) {
      return NextResponse.json({ error: 'nodeToken and instruction are required' }, { status: 400 })
    }

    // Resolve node token → document id, then fetch content
    const documentId = await resolveNodeToDocId(nodeToken)
    const originalContent = await getDocumentContent(documentId)

    // Ask Claude to apply the requested change
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: 'You are a wiki editor assistant for Hoho Wellness SOPs. Apply the requested change to the wiki content. Return ONLY the full updated content with the change applied — no commentary, no markdown code fences.',
      messages: [
        {
          role: 'user',
          content: `Current wiki content:\n\n${originalContent}\n\n---\n\nRequested change: ${instruction.trim()}\n\nReturn the complete updated content.`,
        },
      ],
    })

    const proposedContent = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('')
      .trim()

    return NextResponse.json({ before: originalContent.trim(), after: proposedContent, documentId })
  } catch (e: any) {
    console.error('[wiki/edit-draft]', e)
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
