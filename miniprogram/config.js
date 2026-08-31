/**
 * 小芽记配置
 *
 * 不填 cloudEnv 时使用本机缓存，适合先体验「快速记录」。
 * 家庭多设备同步：在微信开发者工具开通云开发后，把环境 ID 填到 cloudEnv。
 *
 * DeepSeek：正式环境把密钥放在云函数环境变量 DEEPSEEK_API_KEY，不要写进小程序。
 * deepseekApiKey 仅供开发者工具本机调试；上线前务必清空。
 */
module.exports = {
  appName: '小芽记',
  cloudEnv: '',
  inviteCodeLength: 6,
  deepseekApiKey: '',
  deepseekModel: 'deepseek-v4-flash',
  deepseekBaseUrl: 'https://api.deepseek.com/chat/completions'
}
