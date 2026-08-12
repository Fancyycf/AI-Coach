export const TOTAL_QUESTIONS = 18

export const DIMENSIONS = [
  {
    name: 'AI 产品思维',
    desc: '识别 AI 真正能解决问题的场景，判断价值与可行性',
    color: '#5b7fb5',
  },
  {
    name: '技术理解',
    desc: '理解大模型的能力边界、成本与关键技术概念',
    color: '#4e9f9a',
  },
  {
    name: '数据与评估',
    desc: '设计评测指标，用数据验证产品效果',
    color: '#6fa56e',
  },
  {
    name: '交互与体验',
    desc: '设计人机协作流程与直觉的对话体验',
    color: '#c98a52',
  },
  {
    name: '规划与落地',
    desc: '把想法拆成可交付的路线图，并推动上线',
    color: '#8f77b5',
  },
  {
    name: '合规与风险',
    desc: '识别隐私、偏见、幻觉等风险并提前设防',
    color: '#c47696',
  },
]

export function levelFor(total) {
  if (total >= 80) return '高级水平'
  if (total >= 60) return '中级水平'
  return '入门水平'
}
