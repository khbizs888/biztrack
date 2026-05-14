import { NextRequest, NextResponse } from 'next/server'
import { replaceDocumentContent } from '@/lib/lark'

export async function POST(req: NextRequest) {
  try {
    const { documentId, content } = await req.json()
    if (!documentId || !content?.trim()) {
      return NextResponse.json({ error: 'documentId and content are required' }, { status: 400 })
    }

    await replaceDocumentContent(documentId, content.trim())
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[wiki/edit-apply]', e)
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
