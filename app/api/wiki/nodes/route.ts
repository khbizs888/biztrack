import { NextResponse } from 'next/server'
import { listWikiNodes } from '@/lib/lark'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const nodes = await listWikiNodes()
    // Return only the fields the UI needs
    return NextResponse.json({
      nodes: nodes.map(n => ({ node_token: n.node_token, title: n.title })),
    })
  } catch (e: any) {
    console.error('[wiki/nodes]', e)
    return NextResponse.json({ nodes: [], error: e.message }, { status: 500 })
  }
}
