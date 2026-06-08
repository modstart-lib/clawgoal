import { getLocale } from '@/locale'

export const generateSubjectsPrompt = (
  count: number,
  description: string
): string => {
  const locale = getLocale()
  if (locale === 'zh-CN') {
    return `基于以下产品或领域描述，生成 ${count} 个适合撰写文章的主题。要求：
1. 每个主题独立成行
2. 主题要具体且有吸引力
3. 适合作为营销文章的标题
4. 只输出主题列表，不要其他说明文字
5. 每行格式：主题内容

产品或领域描述：
${description}

请直接输出 ${count} 个主题，每行一个：`
  }
  return `Based on the following product or domain description, generate ${count} article topics. Requirements:
1. Each topic on a separate line
2. Topics should be specific and engaging
3. Suitable as marketing article titles
4. Output only the topic list, no other explanatory text
5. Format: topic content

Product/Domain Description:
${description}

Please output ${count} topics, one per line:`
}
