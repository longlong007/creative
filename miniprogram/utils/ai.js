const config = require('../config')
const db = require('./db')
const { SYSTEM_PROMPT, userMessage, allowedModel } = require('./ai-prompt')

function failMessage(err) {
  if (!err) return '分析失败'
  if (typeof err === 'string') return err
  return err.message || err.errMsg || '分析失败'
}

function hasDirectKey() {
  return Boolean(config.deepseekApiKey)
}

function canAnalyze() {
  return Boolean(db.cloudReady || hasDirectKey())
}

function setupHint() {
  return '还没接上 DeepSeek。推荐：开通云开发，部署云函数 aiAnalyze，并设置环境变量 DEEPSEEK_API_KEY。本机调试也可在 config.js 填写 deepseekApiKey（不要提交到仓库）。'
}

function requestDeepseek(body, apiKey) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.deepseekBaseUrl || 'https://api.deepseek.com/chat/completions',
      method: 'POST',
      timeout: 60000,
      header: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      data: body,
      success(res) {
        if (res.statusCode >= 400) {
          const msg = (res.data && res.data.error && res.data.error.message) || 'DeepSeek 返回错误'
          reject(new Error(msg))
          return
        }
        const choice = res.data && res.data.choices && res.data.choices[0]
        const text = choice && choice.message && choice.message.content
        if (!text) {
          reject(new Error('模型没有返回内容'))
          return
        }
        resolve({
          ok: true,
          text: String(text).trim(),
          model: body.model,
          thinking: Boolean(body.thinking && body.thinking.type === 'enabled'),
          usage: res.data.usage || null
        })
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || '网络失败'))
      }
    })
  })
}

function buildBody(payload, model, thinking) {
  const body = {
    model: allowedModel(model || config.deepseekModel),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage(payload) }
    ],
    temperature: thinking ? 0.5 : 0.6,
    max_tokens: thinking ? 3500 : 1800,
    stream: false,
    thinking: { type: thinking ? 'enabled' : 'disabled' }
  }
  if (thinking) body.reasoning_effort = 'high'
  return body
}

async function analyze({ payload, model, thinking }) {
  if (!payload || !payload.summary || payload.summary.recordCount < 1) {
    throw new Error('这一段还没什么记录，先记几条再分析')
  }

  if (db.cloudReady && typeof wx !== 'undefined' && wx.cloud) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'aiAnalyze',
        data: {
          payload,
          model: allowedModel(model || config.deepseekModel),
          thinking: Boolean(thinking)
        }
      })
      const result = res.result || {}
      if (result.ok && result.text) return result
      if (result.code === 'NO_KEY' && hasDirectKey()) {
        return requestDeepseek(buildBody(payload, model, thinking), config.deepseekApiKey)
      }
      throw new Error(result.error || '分析失败')
    } catch (err) {
      if (hasDirectKey()) {
        return requestDeepseek(buildBody(payload, model, thinking), config.deepseekApiKey)
      }
      throw new Error(failMessage(err))
    }
  }

  if (hasDirectKey()) {
    return requestDeepseek(buildBody(payload, model, thinking), config.deepseekApiKey)
  }

  throw new Error(setupHint())
}

module.exports = {
  canAnalyze,
  setupHint,
  analyze
}
