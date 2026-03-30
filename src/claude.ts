import Anthropic from '@anthropic-ai/sdk'

// NOTE: プロトタイプ用。APIキーがブラウザに露出するため本番では必ずバックエンド経由にする。
const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY as string,
  dangerouslyAllowBrowser: true,
})

export async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve({ data: result.split(',')[1], mediaType: file.type })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 機能①: 音声認識テキストをAIで解析して薬剤名・使用数量を判別する
export async function parseSpeechWithAI(
  transcript: string,
  productNames: string[]
): Promise<{ productName: string; quantity: number } | null> {
  const list = productNames.join('、')
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 128,
    messages: [{
      role: 'user',
      content: `美容室スタッフの発話から薬剤名と使用本数を抽出してください。
登録済み薬剤: ${list}
発話: 「${transcript}」

登録済み薬剤の中で最も一致するものを選んでください。
JSON形式のみで返答: {"productName": "カラー剤A", "quantity": 2}
判断できない場合: {"productName": "", "quantity": 0}`,
    }],
  })
  try {
    const text = (res.content[0] as { text: string }).text
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    if (!parsed.productName || parsed.quantity <= 0) return null
    return parsed
  } catch {
    return null
  }
}

// 機能②: 薬剤パッケージ画像から商品名と容量を読み取る
export async function extractProductFromImage(
  data: string,
  mediaType: string
): Promise<{ name: string; volume: string }> {
  const res = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data } },
        { type: 'text', text: '美容室の薬剤パッケージの画像です。商品名と容量をJSON形式で返してください。例: {"name": "カラー剤A 80ml", "volume": "80ml"} 読み取れない場合は {"name": "", "volume": ""} を返してください。JSONのみ返答してください。' },
      ],
    }],
  })
  try {
    const text = (res.content[0] as { text: string }).text
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return { name: '', volume: '' }
  }
}

// 機能③: 棚の写真から薬剤の本数を数える
export async function countStockFromImage(
  data: string,
  mediaType: string,
  productNames: string[]
): Promise<{ counts: { name: string; count: number }[]; notes: string }> {
  const list = productNames.length > 0 ? `登録済み薬剤: ${productNames.join('、')}` : ''
  const res = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data } },
        { type: 'text', text: `美容室の棚の画像です。薬剤の本数を数えてください。\n${list}\n\n確認できた薬剤の名前と本数をJSONで返してください。例: {"counts": [{"name": "カラー剤A", "count": 5}], "notes": "補足"}\nJSONのみ返答してください。` },
      ],
    }],
  })
  try {
    const text = (res.content[0] as { text: string }).text
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return { counts: [], notes: '解析に失敗しました' }
  }
}
