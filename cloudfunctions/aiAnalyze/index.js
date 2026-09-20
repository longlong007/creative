const https = require('https')
const { URL } = require('url')
const cloud = require('wx-server-sdk')
const { SYSTEM_PROMPT, userMessage, allowedModel } = require('./prompt')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function readApiKey() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY
  try {
    const secret = require('./secret')
    return secret.DEEPSEEK_API_KEY || secret.apiKey || ''
  } catch (e) {
    return ''
  }
}

function postJson(url, headers, body, timeoutMs) {
  const u = new URL(url)
  const data = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: Object.assign(
          {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          headers
        ),
        timeout: timeoutMs || 50000
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          let json = null
          try {
            json = JSON.parse(raw)
          } catch (e) {
            reject(new Error('模型返回无法解析'))
            return
          }
          if (res.statusCode >= 400) {
            const msg = (json.error && json.error.message) || raw.slice(0, 180)
            reject(new Error(msg))
            return
          }
          resolve(json)
        })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('分析超时，请稍后再试'))
    })
    req.write(data)
    req.end()
  })
}

function pickText(json) {
  const choice = json && json.choices && json.choices[0]
  const msg = choice && choice.message
  if (!msg) return ''
  if (typeof msg.content === 'string') return msg.content
  if (Array.isArray(msg.content)) {
    return msg.content.map((part) => part.text || '').join('')
  }
  return ''
}

exports.main = async (event) => {
  const key = readApiKey()
  if (!key) {
    return { ok: false, code: 'NO_KEY', error: '还没有配置 DeepSeek 密钥。请在云函数环境变量里设置 DEEPSEEK_API_KEY。' }
  }

  const payload = event && event.payload
  if (!payload || !payload.baby) {
    return { ok: false, code: 'BAD_PAYLOAD', error: '缺少要分析的记录' }
  }

  const model = allowedModel(event.model)
  const thinking = Boolean(event.thinking)
  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage(payload) }
    ],
    temperature: thinking ? 0.5 : 0.6,
    max_tokens: thinking ? 3500 : 1800,
    stream: false
  }
  if (thinking) {
    body.thinking = { type: 'enabled' }
    body.reasoning_effort = 'high'
  } else {
    body.thinking = { type: 'disabled' }
  }

  try {
    const json = await postJson(
      'https://api.deepseek.com/chat/completions',
      { Authorization: 'Bearer ' + key },
      body,
      thinking ? 55000 : 40000
    )
    const text = String(pickText(json) || '').trim()
    if (!text) return { ok: false, code: 'UPSTREAM', error: '模型没有返回内容' }
    return {
      ok: true,
      text,
      model,
      thinking,
      usage: json.usage || null
    }
  } catch (err) {
    return { ok: false, code: 'UPSTREAM', error: err.message || '调用 DeepSeek 失败' }
  }
}
